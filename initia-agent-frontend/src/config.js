const env = import.meta.env;
const l1BridgeDenom =
  env.VITE_INITIA_L1_BRIDGE_DENOM ?? env.VITE_INITIA_BRIDGE_DENOM ?? "uinit";
const l2BridgeDenom =
  env.VITE_INITIA_L2_BRIDGE_DENOM ??
  "l2/fce3dc08c5562b58dd76a64a775d68726a3f932a3b59165998ed6e300e1680c1";

export const appConfig = {
  chainId: env.VITE_APPCHAIN_ID ?? "initia-agent-1",
  rpcUrl: env.VITE_INITIA_RPC_URL ?? "http://localhost:26657",
  restUrl: env.VITE_INITIA_REST_URL ?? "http://localhost:1317",
  indexerUrl: env.VITE_INITIA_INDEXER_URL ?? "http://localhost:8080",
  l1ChainId: env.VITE_INITIA_L1_CHAIN_ID ?? "initiation-2",
  l1RestUrl: env.VITE_INITIA_L1_REST_URL ?? "https://rest.testnet.initia.xyz",
  moduleAddress:
    env.VITE_MODULE_ADDRESS ?? "init1x7ldlxtyxf4cpraludzwmvx4vnqjz0w6em2qs9",
  moduleName: "agent_actions",
  nativeDenom: env.VITE_NATIVE_DENOM ?? "umin",
  nativeSymbol: env.VITE_NATIVE_SYMBOL ?? "MIN",
  nativeDecimals: Number(env.VITE_NATIVE_DECIMALS ?? 6),
  bridgeId: Number(env.VITE_INITIA_BRIDGE_ID ?? 1662),
  bridgeDenom: l1BridgeDenom,
  l1BridgeDenom,
  l2BridgeDenom,
  bridgeSymbol: env.VITE_INITIA_BRIDGE_SYMBOL ?? "INIT",
  bridgeDecimals: Number(env.VITE_INITIA_BRIDGE_DECIMALS ?? 6),
  usernameRegistrationUrl: "https://usernames.testnet.initia.xyz",
};

export const customChain = {
  chain_id: appConfig.chainId,
  chain_name: "initia-agent",
  pretty_name: "Initia Agent",
  network_type: "testnet",
  bech32_prefix: "init",
  logo_URIs: {
    png: "https://raw.githubusercontent.com/initia-labs/initia-registry/main/testnets/initia/images/initia.png",
    svg: "https://raw.githubusercontent.com/initia-labs/initia-registry/main/testnets/initia/images/initia.svg",
  },
  apis: {
    rpc: [{ address: appConfig.rpcUrl }],
    rest: [{ address: appConfig.restUrl }],
    indexer: [{ address: appConfig.indexerUrl }],
  },
  fees: {
    fee_tokens: [
      {
        denom: appConfig.nativeDenom,
        fixed_min_gas_price: 0,
        low_gas_price: 0,
        average_gas_price: 0,
        high_gas_price: 0,
      },
    ],
  },
  staking: {
    staking_tokens: [{ denom: appConfig.nativeDenom }],
  },
  native_assets: [
    {
      denom: appConfig.nativeDenom,
      name: "Initia Agent Token",
      symbol: appConfig.nativeSymbol,
      decimals: appConfig.nativeDecimals,
    },
    {
      denom: appConfig.l2BridgeDenom,
      name: "Initia",
      symbol: appConfig.bridgeSymbol,
      decimals: appConfig.bridgeDecimals,
    },
  ],
  metadata: {
    is_l1: false,
    minitia: {
      type: "minimove",
    },
  },
};

export function shortenAddress(value) {
  if (!value) return "";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}
