import { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Clock3,
  Coins,
  ReceiptText,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

import { getRevenueStats, subscribeRevenue } from "./revenue.js";

const UINIT_DECIMALS = 1e6;

function formatRevenue(value) {
  if (value < 0.01) return value.toFixed(4);
  return value.toFixed(2);
}

function formatCount(value) {
  return value.toLocaleString();
}

function formatRate(rate) {
  if (rate === 0) return "0";
  if (rate < 0.1) return rate.toFixed(2);
  return rate.toFixed(1);
}

function formatDuration(ms) {
  if (ms <= 0) return "Fresh session";

  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 60) {
    return `${Math.max(totalMinutes, 1)}m active`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) {
    return minutes > 0 ? `${hours}h ${minutes}m active` : `${hours}h active`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0
    ? `${days}d ${remainingHours}h active`
    : `${days}d active`;
}

function formatRelativeTime(value) {
  if (!value) return "No activity yet";

  const diffMs = Date.now() - new Date(value).getTime();
  if (diffMs < 45_000) return "just now";

  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function shortenHash(hash) {
  if (!hash || hash.length <= 18) return hash || "--";
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function getTopAction(breakdown) {
  const entries = Object.entries(breakdown || {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const [action, count] = entries[0];
  return { action, count };
}

function getPeakBucket(histogram) {
  if (!histogram || histogram.length === 0) return null;
  return histogram.reduce((best, bucket) => (
    !best || bucket.count > best.count ? bucket : best
  ), null);
}

function MiniBarChart({ histogram }) {
  if (!histogram || histogram.length === 0) {
    return (
      <div className="rev-chart-empty">
        <Sparkles size={16} />
        <div>
          <strong>No transaction data yet</strong>
          <span>Execute agent actions to unlock throughput trends.</span>
        </div>
      </div>
    );
  }

  const max = Math.max(...histogram.map((bucket) => bucket.count), 1);
  const total = histogram.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <div className="rev-chart">
      <div className="rev-chart__meta">
        <span>{formatCount(total)} tx tracked</span>
        <span>5 minute buckets</span>
      </div>
      <div className="rev-chart__bars">
        {histogram.map((bucket) => (
          <div key={bucket.time} className="rev-chart__col">
            <div
              className="rev-chart__bar"
              style={{ height: `${(bucket.count / max) * 100}%` }}
              title={`${bucket.count} tx at ${new Date(bucket.time).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}`}
            />
          </div>
        ))}
      </div>
      <div className="rev-chart__labels">
        <span>
          {new Date(histogram[0].time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        {histogram.length > 1 && (
          <span>
            {new Date(histogram[histogram.length - 1].time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

function BreakdownList({ breakdown }) {
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return (
      <div className="rev-empty-card rev-empty-card--subtle">
        <Sparkles size={16} />
        <div>
          <strong>No action mix yet</strong>
          <span>As transactions land, we will map the revenue mix here.</span>
        </div>
      </div>
    );
  }

  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  return (
    <div className="rev-breakdown">
      {entries.map(([action, count]) => {
        const pct = total > 0 ? (count / total) * 100 : 0;

        return (
          <div key={action} className="rev-breakdown__row">
            <div className="rev-breakdown__main">
              <span className="rev-breakdown__action">{action}</span>
              <div className="rev-breakdown__bar-track">
                <div
                  className="rev-breakdown__bar-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <div className="rev-breakdown__meta">
              <span className="rev-breakdown__count">{count}</span>
              <span className="rev-breakdown__share">{pct.toFixed(0)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecentTransactions({ transactions }) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="rev-empty-card">
        <ReceiptText size={16} />
        <div>
          <strong>No transactions recorded</strong>
          <span>
            Your latest transaction hashes, timestamps, and fee estimates will
            appear here.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rev-feed">
      {transactions
        .slice(-4)
        .reverse()
        .map((tx, index) => {
          const fee = (tx.gasUsed || 0) / UINIT_DECIMALS;
          const timestamp = new Date(tx.timestamp);

          return (
            <article
              key={`${tx.txHash || tx.timestamp}-${index}`}
              className="rev-feed__item"
            >
              <div className="rev-feed__identity">
                <div className="rev-feed__icon">
                  <ReceiptText size={15} />
                </div>
                <div className="rev-feed__copy">
                  <div className="rev-feed__topline">
                    <strong>{tx.action}</strong>
                    <span className="rev-feed__hash">{shortenHash(tx.txHash)}</span>
                  </div>
                  <span className="rev-feed__meta">
                    {timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" • "}
                    {formatRelativeTime(timestamp)}
                  </span>
                </div>
              </div>
              <div className="rev-feed__value">
                <span className="rev-feed__value-label">Est. fee</span>
                <strong>{formatRevenue(fee)} INIT</strong>
              </div>
            </article>
          );
        })}
    </div>
  );
}

export default function Revenue({ embedded = false, showHeader = true }) {
  const [stats, setStats] = useState(getRevenueStats);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    return subscribeRevenue(setStats);
  }, []);

  const transactions = stats.transactions || [];
  const lastTx = transactions[transactions.length - 1] || null;
  const firstTx = transactions[0] || null;
  const topAction = getTopAction(stats.breakdown);
  const peakBucket = getPeakBucket(stats.histogram);
  const sessionMs = firstTx && lastTx
    ? new Date(lastTx.timestamp).getTime() - new Date(firstTx.timestamp).getTime()
    : 0;
  const avgFeePerTx = stats.totalTx > 0 ? stats.estimatedRevenue / stats.totalTx : 0;
  const recentWindowCount = lastTx
    ? transactions.filter((tx) => (
      new Date(tx.timestamp).getTime()
      >= new Date(lastTx.timestamp).getTime() - 15 * 60_000
    )).length
    : 0;
  const isCollapsed = showHeader ? collapsed : false;

  return (
    <section className={`rev-panel ${embedded ? "rev-panel--embedded" : ""}`}>
      {showHeader && (
        <button
          type="button"
          className="rev-panel__header"
          onClick={() => setCollapsed((current) => !current)}
        >
          <div className="rev-panel__header-copy">
            <div className="rev-panel__kicker-row">
              <p className="eyebrow">Sequencer Revenue</p>
              <span className="rev-status-pill">
                <span className="rev-status-pill__dot" />
                Live Session
              </span>
            </div>
            <h3 className="rev-panel__title">Revenue Dashboard</h3>
            <p className="rev-panel__subtitle">
              Monitor fee flow, throughput, and action-level performance from one
              premium control surface.
            </p>
          </div>

          <div className="rev-panel__header-summary">
            <span className="rev-panel__summary-label">Revenue captured</span>
            <strong>{formatRevenue(stats.estimatedRevenue)} INIT</strong>
            <span className="rev-panel__summary-meta">
              {stats.totalTx > 0
                ? `${formatCount(stats.totalTx)} tx • last activity ${formatRelativeTime(lastTx?.timestamp)}`
                : "Waiting for the first transaction"}
            </span>
          </div>

          <span className="rev-panel__toggle">
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </span>
        </button>
      )}

      {!isCollapsed && (
        <div className="rev-panel__body">
          <div className="rev-hero">
            <div>
              <span className="rev-hero__eyebrow">
                <ArrowUpRight size={14} />
                Revenue pulse
              </span>
              <p className="rev-hero__text">
                {stats.totalTx > 0
                  ? `Running for ${formatDuration(sessionMs)} with ${recentWindowCount} transaction${recentWindowCount === 1 ? "" : "s"} in the latest activity window.`
                  : "Run a few agent actions and this space will turn into a live performance snapshot."}
              </p>
            </div>

            <div className="rev-hero__chips">
              <div className="rev-chip">
                <Clock3 size={14} />
                <span>{lastTx ? `Updated ${formatRelativeTime(lastTx.timestamp)}` : "No live events yet"}</span>
              </div>
              <div className="rev-chip">
                <Coins size={14} />
                <span>
                  {stats.totalTx > 0
                    ? `${formatRevenue(avgFeePerTx)} INIT average fee`
                    : "Average fee unlocks after the first tx"}
                </span>
              </div>
            </div>
          </div>

          <div className="rev-stats-grid">
            <article className="rev-stat-card rev-stat-card--accent">
              <div className="rev-stat-card__icon">
                <Activity size={16} />
              </div>
              <span className="rev-stat-card__label">Total Transactions</span>
              <strong className="rev-stat-card__value">{formatCount(stats.totalTx)}</strong>
              <span className="rev-stat-card__meta">Cumulative executions recorded</span>
            </article>

            <article className="rev-stat-card rev-stat-card--green">
              <div className="rev-stat-card__icon">
                <TrendingUp size={16} />
              </div>
              <span className="rev-stat-card__label">Transactions Per Min</span>
              <strong className="rev-stat-card__value">
                {formatRate(stats.txPerMinute)}
              </strong>
              <span className="rev-stat-card__meta">Session throughput trend</span>
            </article>

            <article className="rev-stat-card rev-stat-card--violet">
              <div className="rev-stat-card__icon">
                <Zap size={16} />
              </div>
              <span className="rev-stat-card__label">Top Action</span>
              <strong className="rev-stat-card__value">
                {topAction ? topAction.action : "--"}
              </strong>
              <span className="rev-stat-card__meta">
                {topAction
                  ? `${topAction.count} executions leading the mix`
                  : "Action mix appears after the first tx"}
              </span>
            </article>

            <article className="rev-stat-card rev-stat-card--amber">
              <div className="rev-stat-card__icon">
                <Coins size={16} />
              </div>
              <span className="rev-stat-card__label">Peak 5m Burst</span>
              <strong className="rev-stat-card__value">
                {peakBucket ? `${peakBucket.count} tx` : "--"}
              </strong>
              <span className="rev-stat-card__meta">
                {peakBucket
                  ? `Started ${new Date(peakBucket.time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                  : "Burst insights unlock after activity"}
              </span>
            </article>
          </div>

          <div className="rev-surface-grid">
            <section className="rev-section rev-surface">
              <div className="rev-section__header">
                <div>
                  <h4 className="section-title">Transaction Activity</h4>
                  <p className="rev-section__subtitle">
                    View how volume is spreading across recent execution windows.
                  </p>
                </div>
                <span className="rev-section__badge">
                  <TrendingUp size={14} />
                  5m cadence
                </span>
              </div>
              <MiniBarChart histogram={stats.histogram} />
            </section>

            <section className="rev-section rev-surface">
              <div className="rev-section__header">
                <div>
                  <h4 className="section-title">Revenue by Action</h4>
                  <p className="rev-section__subtitle">
                    Identify the actions driving the most sequencer demand.
                  </p>
                </div>
                <span className="rev-section__badge rev-section__badge--soft">
                  <Sparkles size={14} />
                  Live mix
                </span>
              </div>
              <BreakdownList breakdown={stats.breakdown} />
            </section>
          </div>

          <section className="rev-section rev-surface">
            <div className="rev-section__header">
              <div>
                <h4 className="section-title">Recent Revenue Events</h4>
                <p className="rev-section__subtitle">
                  Latest transaction-level entries with fee estimates and timing.
                </p>
              </div>
              <span className="rev-section__badge rev-section__badge--green">
                <ReceiptText size={14} />
                {transactions.length > 0 ? "Live feed" : "Awaiting events"}
              </span>
            </div>
            <RecentTransactions transactions={transactions} />
          </section>
        </div>
      )}
    </section>
  );
}
