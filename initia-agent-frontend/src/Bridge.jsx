import { useEffect, useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { LoaderCircle, RefreshCw } from "lucide-react";

import { appConfig } from "./config.js";
import {
  fetchInitBridgeBalances,
  openInitDepositFlow,
  openInitWithdrawFlow,
} from "./bridge.js";

const EMPTY_BALANCES = Object.freeze({
  l1Raw: "0",
  l2Raw: "0",
  l1Formatted: "0",
  l2Formatted: "0",
});

export default function Bridge({ initiaAddress, refreshNonce = 0 }) {
  const { openDeposit, openWithdraw } = useInterwovenKit();
  const [balances, setBalances] = useState(EMPTY_BALANCES);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadBalances() {
    if (!initiaAddress) {
      setBalances(EMPTY_BALANCES);
      setError("");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      setBalances(await fetchInitBridgeBalances(initiaAddress));
    } catch (loadError) {
      console.error("Failed to load bridge balances", loadError);
      setError("Could not fetch L1/L2 INIT balances right now.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadBalances();
  }, [initiaAddress, refreshNonce]);

  function handleDeposit() {
    setNotice("");

    try {
      openInitDepositFlow({ openDeposit, recipientAddress: initiaAddress });
      setNotice(
        "Bridge modal opened. Confirm the deposit in InterwovenKit to move INIT from L1 into your appchain wallet.",
      );
    } catch (openError) {
      console.error("Failed to open deposit modal", openError);
      setError("Could not open the Interwoven Bridge deposit flow.");
    }
  }

  function handleWithdraw() {
    setNotice("");

    try {
      openInitWithdrawFlow({ openWithdraw, recipientAddress: initiaAddress });
      setNotice(
        "Withdraw modal opened. Confirm the transfer in InterwovenKit to move INIT back to L1.",
      );
    } catch (openError) {
      console.error("Failed to open withdraw modal", openError);
      setError("Could not open the Interwoven Bridge withdraw flow.");
    }
  }

  return (
    <div className="bridge-compact">
      <div className="bridge-balances">
        <article className="bridge-balance">
          <span className="bridge-balance__label">L1 Balance</span>
          <strong className="bridge-balance__value">
            {balances.l1Formatted} {appConfig.bridgeSymbol}
          </strong>
          <span className="bridge-balance__meta">{appConfig.l1ChainId}</span>
        </article>

        <article className="bridge-balance">
          <span className="bridge-balance__label">L2 Balance</span>
          <strong className="bridge-balance__value">
            {balances.l2Formatted} {appConfig.bridgeSymbol}
          </strong>
          <span className="bridge-balance__meta">{appConfig.chainId}</span>
        </article>
      </div>

      <div className="bridge-actions">
        <button type="button" className="bridge-button" onClick={handleDeposit}>
          Deposit
        </button>
        <button
          type="button"
          className="bridge-button bridge-button--secondary"
          onClick={handleWithdraw}
        >
          Withdraw
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => void loadBalances()}
          disabled={isLoading}
          aria-label="Refresh bridge balances"
          title="Refresh bridge balances"
        >
          {isLoading ? (
            <LoaderCircle size={14} className="spin" />
          ) : (
            <RefreshCw size={14} />
          )}
        </button>
      </div>

      <p className="bridge-note">
        The AI chat can open this same deposit flow when you ask to bridge INIT
        from L1.
      </p>

      {notice ? (
        <p className="inline-feedback inline-feedback--success">{notice}</p>
      ) : null}
      {error ? (
        <p className="inline-feedback inline-feedback--error">{error}</p>
      ) : null}
    </div>
  );
}
