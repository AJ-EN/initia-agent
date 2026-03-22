const env = import.meta.env;

export const appConfig = {
  chainId: env.VITE_APPCHAIN_ID ?? "initia-agent-1",
  rpcUrl: env.VITE_INITIA_RPC_URL ?? "http://localhost:26657",
  restUrl: env.VITE_INITIA_REST_URL ?? "http://localhost:1317",
  indexerUrl: env.VITE_INITIA_INDEXER_URL ?? "http://localhost:8080",
  moduleAddress:
    env.VITE_MODULE_ADDRESS ?? "init1x7ldlxtyxf4cpraludzwmvx4vnqjz0w6em2qs9",
  moduleName: "agent_actions",
  nativeDenom: env.VITE_NATIVE_DENOM ?? "umin",
  nativeSymbol: env.VITE_NATIVE_SYMBOL ?? "MIN",
  nativeDecimals: Number(env.VITE_NATIVE_DECIMALS ?? 6),
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
