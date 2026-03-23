import { appConfig } from "./config.js";

export const BRIDGE_STATUS_REFRESH_DELAY_MS = 12000;

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
      appConfig.bridgeDenom,
    ),
    fetchBankBalance(appConfig.restUrl, initiaAddress, appConfig.bridgeDenom),
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

export function openInitDepositFlow({ openDeposit, recipientAddress }) {
  openDeposit({
    denoms: [appConfig.bridgeDenom],
    chainId: appConfig.chainId,
    srcOptions: [
      {
        denom: appConfig.bridgeDenom,
        chainId: appConfig.l1ChainId,
      },
    ],
    recipientAddress,
  });
}

export function openInitWithdrawFlow({ openWithdraw, recipientAddress }) {
  openWithdraw({
    denoms: [appConfig.bridgeDenom],
    chainId: appConfig.chainId,
    dstOptions: [
      {
        denom: appConfig.bridgeDenom,
        chainId: appConfig.l1ChainId,
      },
    ],
    recipientAddress,
  });
}
