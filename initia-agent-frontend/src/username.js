import { RESTClient } from "@initia/initia.js";
import { appConfig } from "./config.js";

const L1_REST = appConfig.l1RestUrl;
const USERNAME_MODULE_ADDRESS =
  "init1gtd96ld0mmpgnzamnqlheqd5wrxgvy6rlz5vf0";
const USERNAME_MODULE_HEX =
  "0x42cd8467b1c86e59bf319e5664a09b6b5840bb3fac64f5ce690b5041c530565a";

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCache(key, value) {
  cache.set(key, { value, ts: Date.now() });
}

function bcsSerializeString(str) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const lenBytes = [];
  let len = bytes.length;
  while (len > 0x7f) {
    lenBytes.push((len & 0x7f) | 0x80);
    len >>>= 7;
  }
  lenBytes.push(len);
  const result = new Uint8Array(lenBytes.length + bytes.length);
  result.set(lenBytes);
  result.set(bytes, lenBytes.length);
  return result;
}

function bcsSerializeAddress(bech32Addr) {
  const hexAddr = bech32ToHex(bech32Addr);
  const clean = hexAddr.replace(/^0x/, "").padStart(64, "0");
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bech32ToHex(bech32Addr) {
  const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  const sepIdx = bech32Addr.lastIndexOf("1");
  const dataPart = bech32Addr.slice(sepIdx + 1, -6);
  const data5bit = [];
  for (const ch of dataPart) {
    data5bit.push(CHARSET.indexOf(ch));
  }
  const data8bit = [];
  let acc = 0;
  let bits = 0;
  for (const val of data5bit) {
    acc = (acc << 5) | val;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      data8bit.push((acc >> bits) & 0xff);
    }
  }
  return (
    "0x" + data8bit.map((b) => b.toString(16).padStart(2, "0")).join("")
  );
}

export async function resolveAddressToUsername(address) {
  if (!address) return null;

  const cacheKey = `addr:${address}`;
  const cached = getCached(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const argBytes = bcsSerializeAddress(address);
    const b64Arg = btoa(String.fromCharCode(...argBytes));

    const res = await fetch(
      `${L1_REST}/initia/move/v1/accounts/${USERNAME_MODULE_ADDRESS}/modules/usernames/view_functions/get_name_from_address`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type_args: [],
          args: [b64Arg],
        }),
      },
    );

    if (!res.ok) {
      setCache(cacheKey, null);
      return null;
    }

    const json = await res.json();
    const data = json.data ? JSON.parse(json.data) : null;

    if (data && typeof data === "string" && data.length > 0) {
      const username = data.endsWith(".init") ? data : `${data}.init`;
      setCache(cacheKey, username);
      return username;
    }

    if (data?.vec && data.vec.length > 0) {
      const name = data.vec[0];
      const username = name.endsWith(".init") ? name : `${name}.init`;
      setCache(cacheKey, username);
      return username;
    }

    setCache(cacheKey, null);
    return null;
  } catch (err) {
    console.warn("Username resolution failed:", err.message);
    setCache(cacheKey, null);
    return null;
  }
}

export async function resolveUsernameToAddress(name) {
  if (!name) return null;
  const cleanName = name.replace(/\.init$/, "");

  const cacheKey = `name:${cleanName}`;
  const cached = getCached(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const argBytes = bcsSerializeString(cleanName);
    const b64Arg = btoa(String.fromCharCode(...argBytes));

    const res = await fetch(
      `${L1_REST}/initia/move/v1/accounts/${USERNAME_MODULE_ADDRESS}/modules/usernames/view_functions/get_address_from_name`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type_args: [],
          args: [b64Arg],
        }),
      },
    );

    if (!res.ok) {
      setCache(cacheKey, null);
      return null;
    }

    const json = await res.json();
    const data = json.data ? JSON.parse(json.data) : null;

    if (data && typeof data === "string" && data.startsWith("0x")) {
      setCache(cacheKey, data);
      return data;
    }

    if (data?.vec && data.vec.length > 0) {
      setCache(cacheKey, data.vec[0]);
      return data.vec[0];
    }

    setCache(cacheKey, null);
    return null;
  } catch (err) {
    console.warn("Username lookup failed:", err.message);
    setCache(cacheKey, null);
    return null;
  }
}

export function clearUsernameCache() {
  cache.clear();
}

export const USERNAME_REGISTRATION_URL =
  "https://usernames.testnet.initia.xyz";
