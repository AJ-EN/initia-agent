import { appConfig } from "./config.js";

export const BRIDGE_STATUS_REFRESH_DELAY_MS = 12000;
const INTERWOVEN_SKIP_QUERY_ROOT = "interwovenkit:skip";
const INIT_LOGO_URI = "https://registry.testnet.initia.xyz/images/INIT.png";
const ALL_ASSETS_QUERY_KEY = [INTERWOVEN_SKIP_QUERY_ROOT, "allAssets"];
const assetsQueryKey = (chainId) => [
  INTERWOVEN_SKIP_QUERY_ROOT,
  "assets",
  chainId,
];
const assetQueryKey = (chainId, denom) => [
  INTERWOVEN_SKIP_QUERY_ROOT,
  "asset",
  chainId,
  denom,
];

const L1_INIT_ASSET = {
  chain_id: appConfig.l1ChainId,
  decimals: appConfig.bridgeDecimals,
  denom: appConfig.l1BridgeDenom,
  description: "The native token of Initia",
  is_cw20: false,
  is_evm: false,
  is_svm: false,
  logo_uri: INIT_LOGO_URI,
  name: "Initia Native Token",
  origin_chain_id: "",
  origin_denom: "",
  symbol: appConfig.bridgeSymbol,
  trace: "",
};

const L2_INIT_ASSET = {
  chain_id: appConfig.chainId,
  decimals: appConfig.bridgeDecimals,
  denom: appConfig.l2BridgeDenom,
  description: `${appConfig.bridgeSymbol} deposited from ${appConfig.l1ChainId}`,
  is_cw20: false,
  is_evm: false,
  is_svm: false,
  logo_uri: INIT_LOGO_URI,
  name: "Initia",
  origin_chain_id: appConfig.l1ChainId,
  origin_denom: appConfig.l1BridgeDenom,
  symbol: appConfig.bridgeSymbol,
  trace: "",
};

function upsertAsset(assets = [], asset) {
  const filtered = assets.filter(
    (item) => item.chain_id !== asset.chain_id || item.denom !== asset.denom,
  );

  return [...filtered, asset];
}

function mergeInitAssetIntoAllAssets(current) {
  const currentMap = current?.chain_to_assets_map ?? {};
  const bucketChainId = appConfig.l1ChainId;
  const currentBucket = currentMap[bucketChainId] ?? { assets: [] };

  return {
    ...current,
    chain_to_assets_map: {
      ...currentMap,
      [bucketChainId]: {
        ...currentBucket,
        assets: upsertAsset(
          upsertAsset(currentBucket.assets, L1_INIT_ASSET),
          L2_INIT_ASSET,
        ),
      },
    },
  };
}

export function primeInterwovenBridgeAssetCache(queryClient) {
  if (!queryClient) {
    return;
  }

  queryClient.setQueryData(ALL_ASSETS_QUERY_KEY, mergeInitAssetIntoAllAssets);
  queryClient.setQueryData(assetsQueryKey(appConfig.chainId), {
    chain_to_assets_map: {
      [appConfig.chainId]: {
        assets: [L2_INIT_ASSET],
      },
    },
  });
  queryClient.setQueryData(
    assetQueryKey(appConfig.chainId, appConfig.l2BridgeDenom),
    L2_INIT_ASSET,
  );
  queryClient.setQueryData(
    assetQueryKey(appConfig.l1ChainId, appConfig.l1BridgeDenom),
    L1_INIT_ASSET,
  );
}

function formatTokenAmount(rawAmount, decimals) {
  const normalized = String(rawAmount ?? "0");

  if (!/^\d+$/.test(normalized)) {
    return "0";
  }

  const padded = normalized.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals) || "0";
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  const formattedWhole = Number.parseInt(whole, 10).toLocaleString();

  return fraction ? `${formattedWhole}.${fraction}` : formattedWhole;
}

async function fetchBankBalance(restUrl, address, denom) {
  if (!address) {
    return "0";
  }

  const response = await fetch(
    `${restUrl}/cosmos/bank/v1beta1/balances/${address}`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch balance from ${restUrl}`);
  }

  const data = await response.json();
  const balance = data.balances?.find((coin) => coin.denom === denom);

  return balance?.amount ?? "0";
}

export async function fetchInitBridgeBalances(initiaAddress) {
  const [l1Raw, l2Raw] = await Promise.all([
    fetchBankBalance(
      appConfig.l1RestUrl,
      initiaAddress,
      appConfig.l1BridgeDenom,
    ),
    fetchBankBalance(appConfig.restUrl, initiaAddress, appConfig.l2BridgeDenom),
  ]);

  return {
    l1Raw,
    l2Raw,
    l1Formatted: formatTokenAmount(l1Raw, appConfig.bridgeDecimals),
    l2Formatted: formatTokenAmount(l2Raw, appConfig.bridgeDecimals),
  };
}

export function formatRequestedInitAmount(amount) {
  const parsed = Number.parseFloat(String(amount ?? ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return appConfig.bridgeSymbol;
  }

  return `${parsed.toLocaleString(undefined, {
    maximumFractionDigits: appConfig.bridgeDecimals,
  })} ${appConfig.bridgeSymbol}`;
}

export function buildInitDepositParams(recipientAddress) {
  return {
    denoms: [appConfig.l2BridgeDenom],
    chainId: appConfig.chainId,
    srcOptions: [
      {
        denom: appConfig.l1BridgeDenom,
        chainId: appConfig.l1ChainId,
      },
    ],
    recipientAddress,
  };
}

export function buildInitWithdrawParams(recipientAddress) {
  return {
    denoms: [appConfig.l2BridgeDenom],
    chainId: appConfig.chainId,
    dstOptions: [
      {
        denom: appConfig.l1BridgeDenom,
        chainId: appConfig.l1ChainId,
      },
    ],
    recipientAddress,
  };
}

export function openInitDepositFlow({
  openDeposit,
  queryClient,
  recipientAddress,
}) {
  primeInterwovenBridgeAssetCache(queryClient);
  const params = buildInitDepositParams(recipientAddress);

  console.info("[bridge] Opening InterwovenKit deposit modal", {
    mode: "deposit",
    bridgeId: appConfig.bridgeId,
    sourceChain: appConfig.l1ChainId,
    sourceDenom: appConfig.l1BridgeDenom,
    destChain: appConfig.chainId,
    destDenom: appConfig.l2BridgeDenom,
    params,
  });

  openDeposit(params);
}

export function openInitWithdrawFlow({
  openWithdraw,
  queryClient,
  recipientAddress,
}) {
  primeInterwovenBridgeAssetCache(queryClient);
  const params = buildInitWithdrawParams(recipientAddress);

  console.info("[bridge] Opening InterwovenKit withdraw modal", {
    mode: "withdraw",
    bridgeId: appConfig.bridgeId,
    sourceChain: appConfig.chainId,
    sourceDenom: appConfig.l2BridgeDenom,
    destChain: appConfig.l1ChainId,
    destDenom: appConfig.l1BridgeDenom,
    params,
  });

  openWithdraw(params);
}
