const STORAGE_KEY = "initia-agent-revenue";

const AVG_GAS_COST_UINIT = 200_000;
const UINIT_DECIMALS = 1e6;

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Rehydrate timestamps
    data.transactions = data.transactions.map((tx) => ({
      ...tx,
      timestamp: new Date(tx.timestamp),
    }));
    return data;
  } catch {
    return null;
  }
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

function createEmptyStore() {
  return {
    transactions: [],
    sessionStart: null,
  };
}

let store = loadFromStorage() || createEmptyStore();
let listeners = [];

function notify() {
  const snapshot = getRevenueStats();
  for (const fn of listeners) fn(snapshot);
}

/**
 * Record a completed transaction.
 */
export function recordTransaction({ action, txHash, gasUsed }) {
  const entry = {
    action,
    txHash,
    gasUsed: gasUsed || AVG_GAS_COST_UINIT,
    timestamp: new Date(),
  };
  store.transactions.push(entry);
  if (!store.sessionStart) {
    store.sessionStart = entry.timestamp.toISOString();
  }
  saveToStorage(store);
  notify();
}

/**
 * Compute aggregate stats from all recorded transactions.
 */
export function getRevenueStats() {
  const txs = store.transactions;
  const totalTx = txs.length;

  const totalGas = txs.reduce((sum, tx) => sum + (tx.gasUsed || AVG_GAS_COST_UINIT), 0);
  const estimatedRevenue = totalGas / UINIT_DECIMALS;

  // Breakdown by action type
  const breakdown = {};
  for (const tx of txs) {
    breakdown[tx.action] = (breakdown[tx.action] || 0) + 1;
  }

  // Transactions per minute (only during active periods)
  let txPerMinute = 0;
  if (txs.length >= 2) {
    const first = new Date(txs[0].timestamp).getTime();
    const last = new Date(txs[txs.length - 1].timestamp).getTime();
    const minutes = (last - first) / 60_000;
    txPerMinute = minutes > 0 ? txs.length / minutes : txs.length;
  }

  // Histogram: group transactions into time buckets for chart
  const histogram = buildHistogram(txs);

  return {
    totalTx,
    totalGas,
    estimatedRevenue,
    breakdown,
    txPerMinute,
    histogram,
    transactions: txs,
  };
}

function buildHistogram(txs) {
  if (txs.length === 0) return [];

  // Group into 5-minute buckets
  const bucketMs = 5 * 60_000;
  const buckets = new Map();

  for (const tx of txs) {
    const t = new Date(tx.timestamp).getTime();
    const key = Math.floor(t / bucketMs) * bucketMs;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  const sorted = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
  // Fill gaps
  if (sorted.length >= 2) {
    const filled = [];
    for (let t = sorted[0][0]; t <= sorted[sorted.length - 1][0]; t += bucketMs) {
      filled.push({ time: t, count: buckets.get(t) || 0 });
    }
    return filled;
  }

  return sorted.map(([time, count]) => ({ time, count }));
}

/**
 * Subscribe to stats changes. Returns unsubscribe fn.
 */
export function subscribeRevenue(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

/**
 * Clear all stored revenue data.
 */
export function clearRevenueData() {
  store = createEmptyStore();
  saveToStorage(store);
  notify();
}
