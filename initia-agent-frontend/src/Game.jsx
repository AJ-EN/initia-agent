import { useEffect, useRef, useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { ExternalLink, RefreshCw, UserRound, Wallet } from "lucide-react";

import Bridge from "./Bridge.jsx";
import { appConfig, shortenAddress } from "./config.js";
import {
  EMPTY_INVENTORY,
  fetchInventory,
  inventoryStructTag,
} from "./inventory.js";
import { USERNAME_REGISTRATION_URL } from "./username.js";

const inventoryCards = [
  { key: "shards", label: "Shards", emoji: "\u26a1" },
  { key: "gems", label: "Gems", emoji: "\ud83d\udc8e" },
  { key: "relics", label: "Relics", emoji: "\ud83d\udd2e" },
  { key: "legendaryRelics", label: "Legendary", emoji: "\ud83d\udc51" },
];

const craftingRecipes = [
  {
    label: "Craft Relic",
    emoji: "\ud83d\udd2e",
    requires: [
      { key: "shards", need: 2, emoji: "\u26a1" },
      { key: "gems", need: 1, emoji: "\ud83d\udc8e" },
    ],
  },
  {
    label: "Upgrade to Legendary",
    emoji: "\ud83d\udc51",
    requires: [{ key: "relics", need: 3, emoji: "\ud83d\udd2e" }],
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

    const duration = 240;
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

function PanelHeader({ eyebrow, title, subtitle, action = null }) {
  return (
    <div className="panel-title-row">
      <div className="panel-title-copy">
        <p className="section-kicker">{eyebrow}</p>
        <h2 className="panel-title">{title}</h2>
        {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
      </div>
      {action ? <div className="panel-title-action">{action}</div> : null}
    </div>
  );
}

function CraftingProgress({ inventory }) {
  return (
    <div className="craft-list">
      {craftingRecipes.map((recipe) => {
        const progressValues = recipe.requires.map((requirement) => {
          const have = inventory[requirement.key] || 0;
          return Math.min(have / requirement.need, 1);
        });
        const percent = Math.min(...progressValues) * 100;
        const canCraft = progressValues.every((value) => value >= 1);
        const inlineRecipe = recipe.requires
          .map((requirement) => {
            const have = Math.min(inventory[requirement.key] || 0, requirement.need);
            return `${have}/${requirement.need} ${requirement.emoji}`;
          })
          .join(" + ");

        return (
          <div key={recipe.label} className="craft-row">
            <div className="craft-row__header">
              <div className="craft-row__copy">
                <span className="craft-row__title">
                  {recipe.emoji} {recipe.label}
                </span>
                <span className="craft-row__recipe">{inlineRecipe}</span>
              </div>

              <span className="craft-row__status">
                {canCraft ? <span className="status-dot" aria-hidden="true" /> : null}
                {canCraft ? "Ready" : "Gathering"}
              </span>
            </div>

            <div className="craft-progress" aria-hidden="true">
              <span
                className={`craft-progress__fill ${canCraft ? "craft-progress__fill--ready" : ""}`}
                style={{ width: `${percent}%` }}
              />
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
  if (!log || log.length === 0) {
    return null;
  }

  return (
    <div className="activity-block">
      <p className="section-kicker">Recent Transactions</p>
      <div className="activity-list">
        {log
          .slice(-4)
          .reverse()
          .map((entry, index) => (
            <div key={`${entry.txHash}-${index}`} className="activity-item">
              <span className="activity-action">{entry.action}</span>
              <code className="activity-hash">{shortenHash(entry.txHash)}</code>
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

function InventoryView({
  inventory,
  isRefreshing,
  onRefresh,
  displayUsername,
  initiaAddress,
  activityLog,
  lastUpdated,
}) {
  return (
    <div className="inspector-panel">
      <PanelHeader
        eyebrow="Inventory"
        title="Live Inventory"
        subtitle="A compact onchain snapshot for your current wallet."
        action={(
          <button
            type="button"
            className="icon-button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh inventory"
            title="Refresh inventory"
          >
            <RefreshCw size={14} className={isRefreshing ? "spin" : ""} />
          </button>
        )}
      />

      <div className="inventory-grid">
        {inventoryCards.map(({ key, label, emoji }) => (
          <article key={key} className="inventory-card">
            <span className="inventory-card__emoji">{emoji}</span>
            <span className="inventory-card__label">{label}</span>
            <strong className="inventory-card__value">
              <AnimatedCounter value={inventory[key]} />
            </strong>
          </article>
        ))}
      </div>

      <div className="account-strip">
        <div className="account-strip__icon">
          <UserRound size={16} />
        </div>
        <div className="account-strip__content">
          <span className="account-strip__label">Initia Username</span>
          {displayUsername ? (
            <strong className="account-strip__value">{displayUsername}</strong>
          ) : (
            <span className="account-strip__value account-strip__value--muted">
              No .init username registered
            </span>
          )}
        </div>

        {!displayUsername ? (
          <a
            href={USERNAME_REGISTRATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="account-strip__link"
          >
            Register
            <ExternalLink size={13} />
          </a>
        ) : null}
      </div>

      <ActivityLog log={activityLog} />

      <div className="metadata-list">
        <div className="metadata-item">
          <span className="metadata-item__label">Wallet</span>
          <code>{displayUsername || shortenAddress(initiaAddress)}</code>
        </div>
        <div className="metadata-item">
          <span className="metadata-item__label">Module</span>
          <code>{shortenAddress(appConfig.moduleAddress)}</code>
        </div>
        <div className="metadata-item">
          <span className="metadata-item__label">Resource</span>
          <code>{appConfig.moduleName}::Inventory</code>
        </div>
        <div className="metadata-item">
          <span className="metadata-item__label">Struct Tag</span>
          <code>{inventoryStructTag}</code>
        </div>
        <div className="metadata-item">
          <span className="metadata-item__label">Last Sync</span>
          <code>
            {lastUpdated
              ? lastUpdated.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "--"}
          </code>
        </div>
      </div>
    </div>
  );
}

function CraftingView({ inventory }) {
  return (
    <div className="inspector-panel">
      <PanelHeader
        eyebrow="Crafting"
        title="Progress"
        subtitle="Everything you need to know before crafting the next upgrade."
      />

      <div className="resource-strip">
        {inventoryCards.map(({ key, label, emoji }) => (
          <div key={key} className="resource-pill">
            <span>{emoji}</span>
            <span>{label}</span>
            <strong>{inventory[key].toLocaleString()}</strong>
          </div>
        ))}
      </div>

      <CraftingProgress inventory={inventory} />
    </div>
  );
}

function BridgeView({ initiaAddress, refreshNonce }) {
  return (
    <div className="inspector-panel">
      <PanelHeader
        eyebrow="Bridge"
        title="Initia Bridge"
        subtitle="Move liquidity between L1 and your appchain wallet without leaving the app."
      />

      <Bridge
        initiaAddress={initiaAddress}
        refreshNonce={refreshNonce}
      />
    </div>
  );
}

export default function Game({
  view = "inventory",
  onRefreshReady,
  activityLog,
  displayUsername,
}) {
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

  if (!initiaAddress) {
    return (
      <div className="inspector-panel inspector-panel--empty">
        <div className="empty-state">
          <div className="empty-state__icon">
            <Wallet size={18} />
          </div>
          <div className="empty-state__copy">
            <h2 className="empty-state__title">Connect a wallet to inspect inventory</h2>
            <p className="empty-state__text">
              Inventory lives onchain under your Initia address.
            </p>
          </div>
          <button type="button" className="inline-button" onClick={openConnect}>
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  let content = null;
  if (view === "inventory") {
    content = (
      <InventoryView
        inventory={inventory}
        isRefreshing={isRefreshing}
        onRefresh={() => void loadInventory()}
        displayUsername={displayUsername}
        initiaAddress={initiaAddress}
        activityLog={activityLog}
        lastUpdated={lastUpdated}
      />
    );
  } else if (view === "crafting") {
    content = <CraftingView inventory={inventory} />;
  } else if (view === "bridge") {
    content = (
      <BridgeView
        initiaAddress={initiaAddress}
        refreshNonce={lastUpdated?.getTime() ?? 0}
      />
    );
  }

  return (
    <>
      {content}
      {error ? <p className="inline-feedback inline-feedback--error">{error}</p> : null}
    </>
  );
}
