import { useEffect, useRef, useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { RefreshCw, Wallet } from "lucide-react";

import Bridge from "./Bridge.jsx";
import { appConfig, shortenAddress } from "./config.js";
import {
  EMPTY_INVENTORY,
  fetchInventory,
  inventoryStructTag,
} from "./inventory.js";

const inventoryCards = [
  { key: "shards", label: "Shards", emoji: "\u26a1", accentClass: "inventory-card--cyan" },
  { key: "gems", label: "Gems", emoji: "\ud83d\udc8e", accentClass: "inventory-card--violet" },
  { key: "relics", label: "Relics", emoji: "\ud83d\udd2e", accentClass: "inventory-card--gold" },
  { key: "legendaryRelics", label: "Legendary", emoji: "\ud83d\udc51", accentClass: "inventory-card--rose" },
];

const craftingRecipes = [
  {
    label: "Craft Relic",
    emoji: "\ud83d\udd2e",
    requires: [
      { key: "shards", need: 2, label: "Shards" },
      { key: "gems", need: 1, label: "Gems" },
    ],
  },
  {
    label: "Upgrade to Legendary",
    emoji: "\ud83d\udc51",
    requires: [{ key: "relics", need: 3, label: "Relics" }],
  },
];

function AnimatedCounter({ value }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;

    if (from === to) return;

    const duration = 600;
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

function CraftingProgress({ inventory }) {
  return (
    <div className="crafting-section">
      <h3 className="section-title">Crafting Progress</h3>
      {craftingRecipes.map((recipe) => {
        const canCraft = recipe.requires.every(
          (req) => (inventory[req.key] || 0) >= req.need,
        );
        return (
          <div
            key={recipe.label}
            className={`craft-card ${canCraft ? "craft-card--ready" : ""}`}
          >
            <div className="craft-card__header">
              <span className="craft-card__emoji">{recipe.emoji}</span>
              <span className="craft-card__label">{recipe.label}</span>
              {canCraft && <span className="craft-card__badge">Ready!</span>}
            </div>
            <div className="craft-card__bars">
              {recipe.requires.map((req) => {
                const have = inventory[req.key] || 0;
                const pct = Math.min((have / req.need) * 100, 100);
                return (
                  <div key={req.key} className="craft-bar">
                    <div className="craft-bar__meta">
                      <span>{req.label}</span>
                      <span>
                        {have}/{req.need}
                      </span>
                    </div>
                    <div className="craft-bar__track">
                      <div
                        className={`craft-bar__fill ${pct >= 100 ? "craft-bar__fill--full" : ""}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function shortenHash(hash) {
  if (!hash || hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}\u2026${hash.slice(-4)}`;
}

function ActivityLog({ log }) {
  if (!log || log.length === 0) return null;

  return (
    <div className="activity-section">
      <h3 className="section-title">Recent Transactions</h3>
      <div className="activity-list">
        {log
          .slice(-5)
          .reverse()
          .map((entry, i) => (
            <div key={`${entry.txHash}-${i}`} className="activity-item">
              <span className="activity-action">{entry.action}</span>
              <code className="activity-hash">
                {shortenHash(entry.txHash)}
              </code>
              <span className="activity-time">
                {entry.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

export default function Game({ onRefreshReady, activityLog }) {
  const { initiaAddress, openConnect } = useInterwovenKit();
  const [inventory, setInventory] = useState(EMPTY_INVENTORY);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const latestRefreshRef = useRef(async () => {});

  async function loadInventory() {
    if (!initiaAddress) {
      setInventory(EMPTY_INVENTORY);
      setLastUpdated(null);
      return;
    }

    setIsRefreshing(true);
    setError("");

    try {
      const nextInventory = await fetchInventory(initiaAddress);
      setInventory(nextInventory);
      setLastUpdated(new Date());
    } catch (loadError) {
      console.error("Failed to load inventory", loadError);
      setError("Could not refresh inventory from the local REST endpoint.");
    } finally {
      setIsRefreshing(false);
    }
  }

  latestRefreshRef.current = loadInventory;

  useEffect(() => {
    if (!initiaAddress) {
      setInventory(EMPTY_INVENTORY);
      setError("");
      setLastUpdated(null);
      return;
    }

    void loadInventory();
  }, [initiaAddress]);

  useEffect(() => {
    if (!onRefreshReady) {
      return undefined;
    }

    const refreshHandler = () => latestRefreshRef.current();
    onRefreshReady(refreshHandler);

    return () => {
      onRefreshReady(null);
    };
  }, [onRefreshReady]);

  return (
    <section className="panel inventory-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Onchain Inventory</p>
          <h2>Agent Actions</h2>
        </div>
        <button
          type="button"
          className="refresh-button"
          onClick={() => void loadInventory()}
          disabled={!initiaAddress || isRefreshing}
          aria-label="Refresh inventory"
        >
          <RefreshCw size={16} className={isRefreshing ? "spin" : ""} />
        </button>
      </div>

      <div className="inventory-panel__body">
        {!initiaAddress ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <Wallet size={18} />
            </div>
            <div>
              <h3>Connect a wallet to inspect inventory</h3>
              <p>
                Your inventory is stored under your account address, so the panel
                needs an active Initia wallet before it can query state.
              </p>
            </div>
            <button
              type="button"
              className="inline-button"
              onClick={openConnect}
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <>
            <div className="inventory-grid">
              {inventoryCards.map(({ key, label, emoji, accentClass }) => (
                <article key={key} className={`inventory-card ${accentClass}`}>
                  <span className="inventory-card__emoji">{emoji}</span>
                  <span className="inventory-card__label">{label}</span>
                  <strong className="inventory-card__value">
                    <AnimatedCounter value={inventory[key]} />
                  </strong>
                </article>
              ))}
            </div>

            <Bridge
              initiaAddress={initiaAddress}
              refreshNonce={lastUpdated?.getTime() ?? 0}
            />

            <CraftingProgress inventory={inventory} />

            <ActivityLog log={activityLog} />

            <div className="detail-list">
              <div className="detail-row">
                <span>Wallet</span>
                <code>{shortenAddress(initiaAddress)}</code>
              </div>
              <div className="detail-row">
                <span>Module</span>
                <code>{shortenAddress(appConfig.moduleAddress)}</code>
              </div>
              <div className="detail-row">
                <span>Resource</span>
                <code>{appConfig.moduleName}::Inventory</code>
              </div>
              <div className="detail-row">
                <span>Struct Tag</span>
                <code className="detail-code">{inventoryStructTag}</code>
              </div>
              <div className="detail-row">
                <span>Last Sync</span>
                <code>
                  {lastUpdated ? lastUpdated.toLocaleTimeString() : "--"}
                </code>
              </div>
            </div>
          </>
        )}

        {error ? <p className="error-text">{error}</p> : null}
      </div>
    </section>
  );
}
