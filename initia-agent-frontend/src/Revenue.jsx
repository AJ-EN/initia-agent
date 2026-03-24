import { useEffect, useState } from "react";

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

function Sparkline({ histogram }) {
  if (!histogram || histogram.length === 0) {
    return (
      <div className="sparkline-empty">
        <strong>No transaction data yet.</strong> Mint some shards or craft a relic to see your throughput chart appear here.
      </div>
    );
  }

  const width = 240;
  const height = 56;
  const max = Math.max(...histogram.map((bucket) => bucket.count), 1);
  const points = histogram.map((bucket, index) => {
    const x =
      histogram.length === 1
        ? (index + 0.5) * width
        : (index / (histogram.length - 1)) * width;
    const y = height - (bucket.count / max) * height;
    return `${x},${y}`;
  });
  const normalizedPoints =
    points.length === 1
      ? [`0,${points[0].split(",")[1]}`, `${width},${points[0].split(",")[1]}`]
      : points;

  const firstBucket = histogram[0];
  const lastBucket = histogram[histogram.length - 1];

  return (
    <div className="sparkline-wrap">
      <svg
        className="sparkline"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline
          fill="none"
          points={normalizedPoints.join(" ")}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>

      <div className="sparkline-meta">
        <span>
          {new Date(firstBucket.time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span>
          {new Date(lastBucket.time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

export default function Revenue() {
  const [stats, setStats] = useState(getRevenueStats);

  useEffect(() => subscribeRevenue(setStats), []);

  const transactions = stats.transactions || [];
  const lastTx = transactions[transactions.length - 1] || null;
  const topAction = getTopAction(stats.breakdown);
  const breakdownEntries = Object.entries(stats.breakdown || {}).sort(
    (a, b) => b[1] - a[1],
  );
  const visibleBreakdown = breakdownEntries.slice(0, 4);

  return (
    <div className="inspector-panel revenue-panel">
      <div className="panel-title-row">
        <div className="panel-title-copy">
          <p className="section-kicker">Revenue</p>
          <h2 className="panel-title">Sequencer Revenue</h2>
          <p className="panel-subtitle">
            Live throughput, fee capture, and recent revenue events in one quiet
            view.
          </p>
        </div>
      </div>

      <div className="revenue-pills">
        <article className="metric-pill">
          <span className="metric-pill__label">Total Tx</span>
          <strong className="metric-pill__value">{formatCount(stats.totalTx)}</strong>
        </article>
        <article className="metric-pill">
          <span className="metric-pill__label">Revenue</span>
          <strong className="metric-pill__value">
            {formatRevenue(stats.estimatedRevenue)} INIT
          </strong>
        </article>
        <article className="metric-pill">
          <span className="metric-pill__label">Rate</span>
          <strong className="metric-pill__value">
            {formatRate(stats.txPerMinute)}/min
          </strong>
        </article>
      </div>

      <Sparkline histogram={stats.histogram} />

      <div className="revenue-summary-row">
        <span className="revenue-summary-item">
          {topAction
            ? `Top action: ${topAction.action} (${topAction.count})`
            : "Top action: --"}
        </span>
        <span className="revenue-summary-item">
          {lastTx ? `Updated ${formatRelativeTime(lastTx.timestamp)}` : "Awaiting activity"}
        </span>
      </div>

      {visibleBreakdown.length > 0 ? (
        <div className="revenue-breakdown">
          {visibleBreakdown.map(([action, count]) => (
            <span key={action} className="revenue-breakdown__pill">
              {action} <strong>{count}</strong>
            </span>
          ))}
        </div>
      ) : null}

      <div className="revenue-feed">
        {transactions.length > 0 ? (
          transactions
            .slice(-3)
            .reverse()
            .map((tx, index) => {
              const fee = (tx.gasUsed || 0) / UINIT_DECIMALS;
              return (
                <article
                  key={`${tx.txHash || tx.timestamp}-${index}`}
                  className="revenue-feed__item"
                >
                  <div className="revenue-feed__main">
                    <strong className="revenue-feed__title">{tx.action}</strong>
                    <span className="revenue-feed__meta">
                      {shortenHash(tx.txHash)} • {formatRelativeTime(tx.timestamp)}
                    </span>
                  </div>
                  <span className="revenue-feed__value">
                    {formatRevenue(fee)} INIT
                  </span>
                </article>
              );
            })
        ) : (
          <div className="sparkline-empty">
            <strong>Awaiting first transaction.</strong> Every action you execute generates sequencer revenue for your appchain.
          </div>
        )}
      </div>
    </div>
  );
}
