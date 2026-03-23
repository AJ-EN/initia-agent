import React, { useCallback, useEffect, useRef, useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import {
  ArrowRight,
  Bot,
  Layers,
  LoaderCircle,
  Shield,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import Chat from "./Chat.jsx";
import { appConfig, shortenAddress } from "./config.js";
import Game from "./Game.jsx";
import { resolveAddressToUsername } from "./username.js";

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

  const handleTransactionLog = useCallback((entry) => {
    setActivityLog((prev) => [...prev, entry]);
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
          <Game
            onRefreshReady={handleRefreshRegistration}
            activityLog={activityLog}
            displayUsername={displayUsername}
          />
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
