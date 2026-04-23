import { useEffect, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";

import { appConfig } from "./config.js";
import { fetchInitBridgeBalances } from "./bridge.js";

const EMPTY_BALANCES = Object.freeze({
  l1Raw: "0",
  l2Raw: "0",
  l1Formatted: "0",
  l2Formatted: "0",
});

export default function Bridge({ initiaAddress, refreshNonce = 0 }) {
  const [balances, setBalances] = useState(EMPTY_BALANCES);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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
        Interwoven Bridge deposit and withdraw are available on registered
        mainnet appchains. This demo runs on a local testnet chain that
        isn't indexed by the bridge router — the integration code is live
        in <code>bridge.js</code> and wired into the AI chat flow.
      </p>

      {error ? (
        <p className="inline-feedback inline-feedback--error">{error}</p>
      ) : null}
    </div>
  );
}
