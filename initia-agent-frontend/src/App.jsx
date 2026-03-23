import React, { useCallback, useEffect, useRef, useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import {
  Activity,
  ArrowRight,
  Bot,
  Coins,
  Layers,
  LoaderCircle,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import Chat from "./Chat.jsx";
import { appConfig, shortenAddress } from "./config.js";
import Game from "./Game.jsx";
import Revenue from "./Revenue.jsx";
import { recordTransaction, getRevenueStats, subscribeRevenue } from "./revenue.js";
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
    <div className="welcome-screen">
      <div className="welcome-card">
        <div className="welcome-glow" />
        <span className="welcome-badge">
          <Sparkles size={14} />
          Powered by Initia
        </span>
        <h2>Welcome to InitiaAgent</h2>
        <p>
          An AI-powered control room for managing onchain inventory on the
          Initia blockchain. Chat with the agent to mint, craft, and upgrade
          resources &mdash; all executed as Move transactions.
        </p>
        <div className="welcome-features">
          <div className="welcome-feature">
            <div className="welcome-feature__icon">
              <Bot size={18} />
            </div>
            <div>
              <strong>AI Chat Interface</strong>
              <span>Natural language commands for onchain actions</span>
            </div>
          </div>
          <div className="welcome-feature">
            <div className="welcome-feature__icon">
              <Layers size={18} />
            </div>
            <div>
              <strong>Live Inventory</strong>
              <span>Real-time resource tracking from chain state</span>
            </div>
          </div>
          <div className="welcome-feature">
            <div className="welcome-feature__icon">
              <Zap size={18} />
            </div>
            <div>
              <strong>Auto-Sign Sessions</strong>
              <span>One-click approval for hands-free transactions</span>
            </div>
          </div>
        </div>
        <button onClick={onConnect} className="welcome-connect">
          Connect Wallet to Start
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
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
  const [activeConsoleTab, setActiveConsoleTab] = useState("actions");
  const [resolvedUsername, setResolvedUsername] = useState(null);
  const inventoryRefreshHandlerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const prevAutoSignRef = useRef(undefined);

  const autoSignLoading = Boolean(autoSign?.isLoading);
  const isAutoSignEnabled = Boolean(
    autoSign?.isEnabledByChain?.[appConfig.chainId],
  );

  const displayUsername = username || resolvedUsername;

  useEffect(() => {
    if (!initiaAddress) {
      setBalance(null);
      setResolvedUsername(null);
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

    if (prev === undefined) return;
    if (prev === isAutoSignEnabled) return;

    if (isAutoSignEnabled) {
      showToast(
        "Session active \u2014 transactions will execute without wallet popups.",
      );
    } else {
      showToast(
        "Auto-sign disabled \u2014 wallet approval required for each transaction.",
      );
    }
  }, [isAutoSignEnabled, autoSignLoading]);

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

  const [revenueSummary, setRevenueSummary] = useState(getRevenueStats);

  useEffect(() => {
    return subscribeRevenue(setRevenueSummary);
  }, []);

  const handleTransactionLog = useCallback((entry) => {
    setActivityLog((prev) => [...prev, entry]);
    recordTransaction({
      action: entry.action,
      txHash: entry.txHash,
      gasUsed: entry.gasUsed,
    });
  }, []);

  if (!initiaAddress) {
    return (
      <div className="app-page app-page--welcome">
        <header className="app-header app-header--centered">
          <div className="hero-copy hero-copy--centered">
            <span className="hero-kicker">
              <Sparkles size={14} />
              Local Move Appchain
            </span>
            <h1>InitiaAgent</h1>
          </div>
        </header>
        <WelcomeScreen onConnect={openConnect} />
        {toast && (
          <div className="toast" role="status">
            <ShieldCheck size={16} />
            {toast}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-page app-page--workspace">
      <header className="app-header">
        <div className="hero-copy">
          <span className="hero-kicker">
            <Sparkles size={14} />
            Local Move Appchain
          </span>
          <h1>InitiaAgent</h1>
          <p>
            AI-powered control room for onchain inventory on{" "}
            <code>{appConfig.chainId}</code>
          </p>
        </div>

        <div className="header-actions">
          <button onClick={openWallet} className="wallet-pill">
            <span className="wallet-pill__dot" />
            {displayUsername ? (
              <>
                <span className="wallet-pill__username">{displayUsername}</span>
                <span className="wallet-pill__addr">{shortenAddress(initiaAddress)}</span>
              </>
            ) : (
              <span>{shortenAddress(initiaAddress)}</span>
            )}
            {balance !== null && (
              <span className="wallet-balance">
                {balance} {appConfig.nativeSymbol}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`auto-sign-pill ${isAutoSignEnabled ? "auto-sign-pill--active" : ""}`}
            onClick={handleAutoSignToggle}
            disabled={!initiaAddress || isAutoSignPending || autoSignLoading}
          >
            <span
              className={`pill-track ${isAutoSignEnabled ? "pill-track--on" : ""}`}
            >
              <span className="pill-knob">
                {isAutoSignPending || autoSignLoading ? (
                  <LoaderCircle size={12} className="spin" />
                ) : isAutoSignEnabled ? (
                  <ShieldCheck size={12} />
                ) : (
                  <Shield size={12} />
                )}
              </span>
            </span>
            <span className="pill-label">
              {isAutoSignPending || autoSignLoading
                ? "Checking\u2026"
                : isAutoSignEnabled
                  ? "Auto-sign On"
                  : "Auto-sign Off"}
            </span>
          </button>

          <p
            className={`header-note ${autoSignError ? "header-note--error" : ""}`}
          >
            {autoSignError
              ? autoSignError
              : isAutoSignEnabled
                ? `Session active \u2022 fees in ${appConfig.nativeDenom}`
                : "Enable auto-sign for hands-free transactions"}
          </p>

          {revenueSummary.totalTx > 0 && (
            <p className="header-revenue-stat">
              <Zap size={13} />
              {revenueSummary.totalTx} tx processed &middot; ~{revenueSummary.estimatedRevenue.toFixed(2)} INIT revenue
            </p>
          )}
        </div>
      </header>

      <main className="workspace-grid">
        <div className="workspace-grid__main">
          <Chat
            onRequestInventoryRefresh={requestInventoryRefresh}
            onTransactionLog={handleTransactionLog}
            displayUsername={displayUsername}
          />
        </div>
        <div className="workspace-grid__side">
          <section className="panel workspace-console">
            <div className="workspace-console__header">
              <div className="workspace-console__copy">
                <p className="eyebrow">Workspace Console</p>
                <h2>
                  {activeConsoleTab === "actions"
                    ? "Agent Operations"
                    : "Revenue Intelligence"}
                </h2>
                <p className="panel-copy">
                  {activeConsoleTab === "actions"
                    ? "Operate the appchain from one place: inspect balances, bridge funds, craft resources, and review the latest executions."
                    : "Track sequencer health, fee capture, and action-level performance without leaving your current workflow."}
                </p>
              </div>

              <div className="workspace-console__summary">
                <article className="workspace-console__summary-card">
                  <span className="workspace-console__summary-icon">
                    <Sparkles size={15} />
                  </span>
                  <span className="workspace-console__summary-label">Wallet Balance</span>
                  <strong>
                    {balance !== null
                      ? `${balance} ${appConfig.nativeSymbol}`
                      : "--"}
                  </strong>
                  <span className="workspace-console__summary-meta">
                    {displayUsername || shortenAddress(initiaAddress)}
                  </span>
                </article>

                <article className="workspace-console__summary-card">
                  <span className="workspace-console__summary-icon workspace-console__summary-icon--cyan">
                    <Activity size={15} />
                  </span>
                  <span className="workspace-console__summary-label">Transactions</span>
                  <strong>{revenueSummary.totalTx.toLocaleString()}</strong>
                  <span className="workspace-console__summary-meta">
                    {revenueSummary.totalTx > 0
                      ? `${Object.keys(revenueSummary.breakdown || {}).length} action type${Object.keys(revenueSummary.breakdown || {}).length === 1 ? "" : "s"} tracked`
                      : "No activity recorded yet"}
                  </span>
                </article>

                <article className="workspace-console__summary-card">
                  <span className="workspace-console__summary-icon workspace-console__summary-icon--gold">
                    <Coins size={15} />
                  </span>
                  <span className="workspace-console__summary-label">Revenue Captured</span>
                  <strong>{formatRevenueMetric(revenueSummary.estimatedRevenue)} INIT</strong>
                  <span className="workspace-console__summary-meta">
                    {isAutoSignEnabled ? "Auto-sign session live" : "Manual approvals enabled"}
                  </span>
                </article>
              </div>
            </div>

            <div className="workspace-console__toolbar">
              <div
                className="workspace-console__tabs"
                role="tablist"
                aria-label="Workspace views"
              >
                <button
                  type="button"
                  role="tab"
                  id="workspace-tab-actions"
                  aria-selected={activeConsoleTab === "actions"}
                  aria-controls="workspace-panel-actions"
                  className={`workspace-console__tab ${activeConsoleTab === "actions" ? "workspace-console__tab--active" : ""}`}
                  onClick={() => setActiveConsoleTab("actions")}
                >
                  <Layers size={15} />
                  Agent Actions
                </button>
                <button
                  type="button"
                  role="tab"
                  id="workspace-tab-revenue"
                  aria-selected={activeConsoleTab === "revenue"}
                  aria-controls="workspace-panel-revenue"
                  className={`workspace-console__tab ${activeConsoleTab === "revenue" ? "workspace-console__tab--active" : ""}`}
                  onClick={() => setActiveConsoleTab("revenue")}
                >
                  <Zap size={15} />
                  Sequencer Revenue
                </button>
              </div>

              <div className="workspace-console__toolbar-side">
                {activeConsoleTab === "actions" ? (
                  <button
                    type="button"
                    className="workspace-console__refresh"
                    onClick={() => void requestInventoryRefresh()}
                  >
                    <RefreshCw size={14} />
                    Sync inventory
                  </button>
                ) : (
                  <span className="workspace-console__live-pill">
                    <span className="workspace-console__live-dot" />
                    Auto updates on every completed tx
                  </span>
                )}
              </div>
            </div>

            <div className="workspace-console__body">
              <div
                id="workspace-panel-actions"
                role="tabpanel"
                aria-labelledby="workspace-tab-actions"
                className={`workspace-console__view ${activeConsoleTab === "actions" ? "" : "workspace-console__view--hidden"}`}
              >
                <Game
                  embedded
                  showHeader={false}
                  onRefreshReady={handleRefreshRegistration}
                  activityLog={activityLog}
                  displayUsername={displayUsername}
                />
              </div>

              <div
                id="workspace-panel-revenue"
                role="tabpanel"
                aria-labelledby="workspace-tab-revenue"
                className={`workspace-console__view ${activeConsoleTab === "revenue" ? "" : "workspace-console__view--hidden"}`}
              >
                <Revenue embedded showHeader={false} />
              </div>
            </div>
          </section>
        </div>
      </main>

      {toast && (
        <div className="toast" role="status">
          <ShieldCheck size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
