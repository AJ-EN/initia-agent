import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import {
  ArrowLeftRight,
  BarChart3,
  Bot,
  Hammer,
  Layers,
  LoaderCircle,
  Package,
  X,
  Zap,
} from "lucide-react";

import Chat from "./Chat.jsx";
import { appConfig, shortenAddress } from "./config.js";
import Game from "./Game.jsx";
import Revenue from "./Revenue.jsx";
import { getRevenueStats, recordTransaction, subscribeRevenue } from "./revenue.js";
import { resolveAddressToUsername } from "./username.js";

function formatRevenueMetric(value) {
  if (value < 0.01) return value.toFixed(4);
  return value.toFixed(2);
}

async function fetchBalance(address) {
  try {
    const res = await fetch(
      `${appConfig.restUrl}/cosmos/bank/v1beta1/balances/${address}`,
    );
    if (!res.ok) return null;

    const data = await res.json();
    const coin = data.balances?.find((b) => b.denom === appConfig.nativeDenom);
    if (!coin) return "0";

    const raw = Number(coin.amount);
    return (raw / Math.pow(10, appConfig.nativeDecimals)).toLocaleString(
      undefined,
      { minimumFractionDigits: 0, maximumFractionDigits: 2 },
    );
  } catch {
    return null;
  }
}

function WelcomeScreen({ onConnect }) {
  return (
    <section className="welcome-screen">
      <p className="section-kicker">Production-ready onchain ops</p>
      <h1 className="welcome-title">Your AI-powered blockchain companion</h1>
      <p className="welcome-subtitle">
        Chat, transact, and track your appchain inventory from one calm control
        surface.
      </p>

      <div className="welcome-features" aria-label="Core product features">
        <div className="welcome-feature">
          <div className="welcome-feature__icon"><Bot size={18} /></div>
          <div className="welcome-feature__copy">
            <strong>AI Chat Interface</strong>
            <span>Natural language commands for onchain actions</span>
          </div>
        </div>
        <div className="welcome-feature">
          <div className="welcome-feature__icon"><Zap size={18} /></div>
          <div className="welcome-feature__copy">
            <strong>Auto-Sign Sessions</strong>
            <span>One-click approval for hands-free transactions</span>
          </div>
        </div>
        <div className="welcome-feature">
          <div className="welcome-feature__icon"><Layers size={18} /></div>
          <div className="welcome-feature__copy">
            <strong>Live Inventory</strong>
            <span>Real-time resource tracking from chain state</span>
          </div>
        </div>
      </div>

      <button type="button" className="welcome-connect" onClick={onConnect}>
        Connect Wallet
      </button>
    </section>
  );
}

function App() {
  const { initiaAddress, username, openConnect, openWallet, autoSign } =
    useInterwovenKit();
  const [isAutoSignPending, setIsAutoSignPending] = useState(false);
  const [autoSignError, setAutoSignError] = useState("");
  const [toast, setToast] = useState("");
  const [balance, setBalance] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [resolvedUsername, setResolvedUsername] = useState(null);
  const [revenueSummary, setRevenueSummary] = useState(getRevenueStats);
  const [activeInspectorPanel, setActiveInspectorPanel] = useState(null);
  const inventoryRefreshHandlerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const prevAutoSignRef = useRef(undefined);

  const autoSignLoading = Boolean(autoSign?.isLoading);
  const isAutoSignEnabled = Boolean(
    autoSign?.isEnabledByChain?.[appConfig.chainId],
  );
  const displayUsername = username || resolvedUsername;

  const inspectorPanels = useMemo(
    () => [
      {
        id: "inventory",
        label: "Inventory",
        icon: Package,
      },
      {
        id: "crafting",
        label: "Crafting",
        icon: Hammer,
      },
      {
        id: "bridge",
        label: "Bridge",
        icon: ArrowLeftRight,
      },
      {
        id: "revenue",
        label: "Revenue",
        icon: BarChart3,
      },
    ],
    [],
  );

  useEffect(() => {
    return () => {
      window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!initiaAddress) {
      setBalance(null);
      setResolvedUsername(null);
      setActiveInspectorPanel(null);
      return;
    }

    fetchBalance(initiaAddress).then(setBalance);
    if (!username) {
      resolveAddressToUsername(initiaAddress).then(setResolvedUsername);
    }
  }, [initiaAddress, username]);

  useEffect(() => {
    if (autoSignLoading) return;

    const prev = prevAutoSignRef.current;
    prevAutoSignRef.current = isAutoSignEnabled;

    if (prev === undefined || prev === isAutoSignEnabled) {
      return;
    }

    if (isAutoSignEnabled) {
      showToast("Session active. Transactions will execute without wallet popups.");
    } else {
      showToast("Auto-sign disabled. Wallet approval is required for each transaction.");
    }
  }, [autoSignLoading, isAutoSignEnabled]);

  useEffect(() => subscribeRevenue(setRevenueSummary), []);

  useEffect(() => {
    if (!activeInspectorPanel) return undefined;

    function handleEscape(event) {
      if (event.key === "Escape") {
        setActiveInspectorPanel(null);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [activeInspectorPanel]);

  function showToast(message) {
    window.clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 4000);
  }

  async function handleAutoSignToggle() {
    if (!initiaAddress || !autoSign || isAutoSignPending) {
      return;
    }

    setIsAutoSignPending(true);
    setAutoSignError("");

    try {
      if (isAutoSignEnabled) {
        try {
          await autoSign.disable(appConfig.chainId);
        } catch (disableError) {
          const message = String(disableError?.message || "");

          if (message.toLowerCase().includes("authorization not found")) {
            await autoSign.enable(appConfig.chainId);
            await autoSign.disable(appConfig.chainId);
          } else {
            throw disableError;
          }
        }
      } else {
        await autoSign.enable(appConfig.chainId);
      }
    } catch (toggleError) {
      console.error("Failed to update auto-sign state", toggleError);
      setAutoSignError("Could not update auto-sign right now. Try again.");
    } finally {
      setIsAutoSignPending(false);
    }
  }

  function handleRefreshRegistration(handler) {
    inventoryRefreshHandlerRef.current = handler;
  }

  function requestInventoryRefresh() {
    if (initiaAddress) {
      fetchBalance(initiaAddress).then(setBalance);
    }
    return inventoryRefreshHandlerRef.current?.();
  }

  const handleTransactionLog = useCallback((entry) => {
    setActivityLog((prev) => [...prev, entry]);
    recordTransaction({
      action: entry.action,
      txHash: entry.txHash,
      gasUsed: entry.gasUsed,
    });
  }, []);

  const walletLabel = displayUsername || shortenAddress(initiaAddress || "");
  const walletMeta =
    balance !== null
      ? `${balance} ${appConfig.nativeSymbol}`
      : shortenAddress(initiaAddress || "");

  function toggleInspectorPanel(panelId) {
    setActiveInspectorPanel((current) =>
      current === panelId ? null : panelId,
    );
  }

  function renderInspectorContent() {
    if (activeInspectorPanel === "revenue") {
      return <Revenue />;
    }

    if (
      activeInspectorPanel === "inventory"
      || activeInspectorPanel === "crafting"
      || activeInspectorPanel === "bridge"
    ) {
      return (
        <Game
          view={activeInspectorPanel}
          onRefreshReady={handleRefreshRegistration}
          activityLog={activityLog}
          displayUsername={displayUsername}
        />
      );
    }

    return null;
  }

  return (
    <div className={`app-shell ${!initiaAddress ? "app-shell--welcome" : ""}`}>
      <header className="topbar">
        <div className="topbar__inner">
          <div className="brand-lockup">
            <span className="brand-title">InitiaAgent</span>
            <span className="brand-badge">on {appConfig.chainId}</span>
          </div>

          {initiaAddress ? (
            <div className="topbar-actions">
              <button
                type="button"
                className={`autosign-toggle ${isAutoSignEnabled ? "autosign-toggle--active" : ""}`}
                onClick={handleAutoSignToggle}
                disabled={!initiaAddress || isAutoSignPending || autoSignLoading}
              >
                {isAutoSignPending || autoSignLoading ? (
                  <>
                    <LoaderCircle size={14} className="spin" />
                    Checking...
                  </>
                ) : isAutoSignEnabled ? (
                  "Auto-sign On"
                ) : (
                  "Auto-sign Off"
                )}
              </button>

              <button type="button" className="wallet-button" onClick={openWallet}>
                <span className="wallet-button__identity">{walletLabel}</span>
                <span className="wallet-button__meta">{walletMeta}</span>
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="app-main">
        {!initiaAddress ? (
          <div className="welcome-layout">
            <WelcomeScreen onConnect={openConnect} />
          </div>
        ) : (
          <div className="workspace workspace--immersive">
            <div className="chat-stage">
              <Chat
                onRequestInventoryRefresh={requestInventoryRefresh}
                onTransactionLog={handleTransactionLog}
                displayUsername={displayUsername}
              />
            </div>

            <aside className="inspector-rail" aria-label="Sidebar tools">
              <div className="inspector-rail__dock">
                {inspectorPanels.map((panel) => {
                  const Icon = panel.icon;
                  const isActive = activeInspectorPanel === panel.id;

                  return (
                    <button
                      key={panel.id}
                      type="button"
                      className={`inspector-rail__button ${isActive ? "inspector-rail__button--active" : ""}`}
                      onClick={() => toggleInspectorPanel(panel.id)}
                      aria-pressed={isActive}
                      title={panel.label}
                    >
                      <Icon size={18} />
                      <span>{panel.label}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            {activeInspectorPanel ? (
              <div
                className="inspector-backdrop"
                onClick={() => setActiveInspectorPanel(null)}
                aria-hidden="true"
              />
            ) : null}

            <div
              className={`inspector-drawer ${activeInspectorPanel ? "inspector-drawer--open" : ""}`}
              aria-hidden={!activeInspectorPanel}
            >
              <button
                type="button"
                className="inspector-drawer__close"
                onClick={() => setActiveInspectorPanel(null)}
                aria-label="Close sidebar"
              >
                <X size={16} />
              </button>

              <div className="inspector-drawer__body">
                {renderInspectorContent()}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div className="app-footer__inner">
          <span
            className={`app-footer__note ${autoSignError ? "app-footer__note--error" : ""}`}
          >
            {autoSignError
              ? autoSignError
              : initiaAddress
                ? `${walletLabel} connected`
                : `Move appchain on ${appConfig.chainId}`}
          </span>
          <span className="app-footer__note">
            {initiaAddress
              ? revenueSummary.totalTx > 0
                ? `${revenueSummary.totalTx.toLocaleString()} tx • ${formatRevenueMetric(revenueSummary.estimatedRevenue)} INIT revenue • ${shortenAddress(appConfig.moduleAddress)}`
                : `Module ${shortenAddress(appConfig.moduleAddress)} • ${appConfig.moduleName}`
              : `Module ${appConfig.moduleName} • ${shortenAddress(appConfig.moduleAddress)}`}
          </span>
        </div>
      </footer>

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

export default App;
