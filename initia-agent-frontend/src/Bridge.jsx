import { useEffect, useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  LoaderCircle,
  RefreshCw,
  Waypoints,
} from "lucide-react";

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
    <div className="bridge-section">
      <div className="bridge-section__header">
        <div className="bridge-section__copy">
          <p className="eyebrow">Interwoven Bridge</p>
          <h3>Bridge INIT Between L1 and Your Appchain</h3>
          <p>
            Native deposit and withdraw flows powered by InterwovenKit for{" "}
            <code>{appConfig.l1ChainId}</code> and <code>{appConfig.chainId}</code>.
          </p>
        </div>
        <button
          type="button"
          className="refresh-button"
          onClick={() => void loadBalances()}
          disabled={!initiaAddress || isLoading}
          aria-label="Refresh bridge balances"
        >
          {isLoading ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <RefreshCw size={16} />
          )}
        </button>
      </div>

      <div className="bridge-balance-grid">
        <article className="bridge-balance-card">
          <span className="bridge-balance-card__eyebrow">Initia L1</span>
          <strong className="bridge-balance-card__value">
            {balances.l1Formatted} {appConfig.bridgeSymbol}
          </strong>
          <span className="bridge-balance-card__meta">
            {appConfig.l1ChainId} • {appConfig.bridgeDenom}
          </span>
        </article>

        <article className="bridge-balance-card">
          <span className="bridge-balance-card__eyebrow">Appchain Wallet</span>
          <strong className="bridge-balance-card__value">
            {balances.l2Formatted} {appConfig.bridgeSymbol}
          </strong>
          <span className="bridge-balance-card__meta">
            {appConfig.chainId} • {appConfig.bridgeDenom}
          </span>
        </article>
      </div>

      <div className="bridge-actions">
        <button
          type="button"
          className="bridge-button"
          onClick={handleDeposit}
        >
          <ArrowDownToLine size={16} />
          Deposit INIT
        </button>
        <button
          type="button"
          className="bridge-button bridge-button--secondary"
          onClick={handleWithdraw}
        >
          <ArrowUpFromLine size={16} />
          Withdraw INIT
        </button>
      </div>

      <div className="bridge-note-row">
        <Waypoints size={15} />
        <p className="bridge-note">
          The AI chat can open this same built-in deposit flow for you when you
          ask to bridge INIT from L1.
        </p>
      </div>

      {notice ? <p className="bridge-note bridge-note--success">{notice}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
