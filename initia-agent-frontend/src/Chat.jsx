import { useEffect, useRef, useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import ReactMarkdown from "react-markdown";
import { Bot, RotateCcw, SendHorizontal, User } from "lucide-react";

import { askAgent, clearAgentHistory, formatActionName, isRevenueRequest, normalizeMessage } from "./agent.js";
import {
  BRIDGE_STATUS_REFRESH_DELAY_MS,
  formatRequestedInitAmount,
  openInitDepositFlow,
} from "./bridge.js";
import { appConfig } from "./config.js";
import { executeAgentActions } from "./executor.js";
import { fetchInventory } from "./inventory.js";
import { getRevenueStats } from "./revenue.js";
import { USERNAME_REGISTRATION_URL } from "./username.js";

function createMessage(role, content, variant = "info", extra = {}) {
  return {
    id:
      globalThis.crypto?.randomUUID?.() ??
      `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    variant,
    timestamp: new Date(),
    ...extra,
  };
}

function shortenHash(hash) {
  if (!hash || hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}\u2026${hash.slice(-4)}`;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function generateSessionId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `s-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

const initialMessages = [
  createMessage(
    "assistant",
    [
      "**InitiaAgent is live onchain.**",
      "",
      "I'm your AI companion for managing resources on the Initia blockchain. I can strategize, execute transactions, and track your progress. Try:",
      "",
      "- `mint 5 shards` \u2014 gather resources",
      "- `deposit 1 INIT from L1` \u2014 bridge funds",
      "- `craft relic` \u2014 combine \u26a1 + \ud83d\udc8e \u2192 \ud83d\udd2e",
      "- `upgrade relic` \u2014 forge \ud83d\udc51 legendary items",
      "- `register my username` \u2014 claim a .init name",
      "- Or just chat \u2014 ask me anything about Initia!",
    ].join("\n"),
    "info",
    { suggestions: ["Mint 5 shards", "Check inventory", "What is Initia?"] },
  ),
];

function formatInventoryMessage(inventory) {
  return [
    "### \ud83c\udfaf Current Inventory",
    "",
    `| Resource | Count |`,
    `|----------|-------|`,
    `| \u26a1 Shards | **${inventory.shards.toLocaleString()}** |`,
    `| \ud83d\udc8e Gems | **${inventory.gems.toLocaleString()}** |`,
    `| \ud83d\udd2e Relics | **${inventory.relics.toLocaleString()}** |`,
    `| \ud83d\udc51 Legendary | **${inventory.legendaryRelics.toLocaleString()}** |`,
  ].join("\n");
}

function formatExecutionMessage(intent, results, autoSignEnabled) {
  const txLines = results.map(
    ({ action, txHash }, index) =>
      `${index + 1}. **${formatActionName(action.functionName)}** \u2192 \`${shortenHash(txHash)}\``,
  );

  const parts = [
    intent.message,
    "",
    `\u2705 Submitted **${results.length}** transaction${results.length === 1 ? "" : "s"} on \`${appConfig.chainId}\`${autoSignEnabled ? " via auto-sign" : ""}`,
    "",
    ...txLines,
  ];

  if (intent.costSummary) {
    parts.push("", `**${intent.costSummary}**`);
  }
  if (intent.balanceLine) {
    parts.push(`*${intent.balanceLine}*`);
  }

  return parts.join("\n");
}

function formatExecutionError(error) {
  const partialResults = Array.isArray(error?.partialResults)
    ? error.partialResults
    : [];
  const detail = String(
    error?.cause?.message || error?.message || "Unexpected error.",
  );

  return [
    "\u274c **Transaction failed**",
    "",
    detail,
    ...(partialResults.length > 0
      ? [
          "",
          "**Completed before failure:**",
          "",
          ...partialResults.map(
            ({ action, txHash }, index) =>
              `${index + 1}. **${formatActionName(action.functionName)}** \u2192 \`${shortenHash(txHash)}\``,
          ),
        ]
      : []),
  ].join("\n");
}

function formatBridgeExecutionMessage(intent) {
  const amountLabel = intent.bridge?.amount
    ? formatRequestedInitAmount(intent.bridge.amount)
    : appConfig.bridgeSymbol;

  return [
    intent.message,
    "",
    `\ud83c\udf09 Opened Interwoven Bridge deposit flow into \`${appConfig.chainId}\`.`,
    "",
    intent.bridge?.amount
      ? `Confirm or enter **${amountLabel}** in the bridge modal to complete the L1 \u2192 L2 deposit.`
      : `Choose how much **${amountLabel}** to bridge from L1 in the modal, then confirm the transfer there.`,
  ].join("\n");
}

export default function Chat({ onRequestInventoryRefresh, onTransactionLog, displayUsername }) {
  const { initiaAddress, requestTxSync, autoSign, openDeposit } =
    useInterwovenKit();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const endRef = useRef(null);
  const refreshTimeoutRef = useRef(null);
  const sessionIdRef = useRef(generateSessionId());

  const autoSignEnabled = Boolean(
    autoSign?.isEnabledByChain?.[appConfig.chainId],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  useEffect(() => {
    return () => {
      window.clearTimeout(refreshTimeoutRef.current);
    };
  }, []);

  function handleClearHistory() {
    void clearAgentHistory(sessionIdRef.current);
    sessionIdRef.current = generateSessionId();
    setMessages(initialMessages);
  }

  function handleSuggestionClick(suggestion) {
    if (isThinking) return;
    setDraft(suggestion);
    // Auto-submit the suggestion
    setMessages((current) => [...current, createMessage("user", suggestion)]);
    setIsThinking(true);
    handleAgentPrompt(suggestion)
      .catch((error) => {
        console.error("Agent execution failed", error);
        setMessages((current) => [
          ...current,
          createMessage("assistant", formatExecutionError(error), "error"),
        ]);
      })
      .finally(() => {
        setIsThinking(false);
        setDraft("");
      });
  }

  async function triggerInventoryRefresh() {
    await onRequestInventoryRefresh?.();

    window.clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = window.setTimeout(() => {
      void onRequestInventoryRefresh?.();
    }, 1200);
  }

  async function handleAgentPrompt(prompt) {
    // Handle revenue queries entirely on the client — the data lives in localStorage
    if (isRevenueRequest(normalizeMessage(prompt))) {
      const stats = getRevenueStats();
      const lines = [
        "Here are your sequencer revenue stats:",
        "",
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Total Transactions | **${stats.totalTx}** |`,
        `| Est. Revenue | **${stats.estimatedRevenue.toFixed(4)} INIT** |`,
        `| Tx/min (active) | **${stats.txPerMinute.toFixed(1)}** |`,
      ];
      if (Object.keys(stats.breakdown).length > 0) {
        lines.push("", "**Revenue by action:**");
        for (const [action, count] of Object.entries(stats.breakdown)) {
          lines.push(`- ${action}: **${count}** tx`);
        }
      }
      if (stats.totalTx === 0) {
        lines.push("", "*No transactions yet — execute some agent actions to start generating revenue!*");
      }
      setMessages((current) => [
        ...current,
        createMessage("assistant", lines.join("\n"), "info", {
          suggestions: ["Mint 5 shards", "Check inventory"],
        }),
      ]);
      return;
    }

    const currentInventory = initiaAddress
      ? await fetchInventory(initiaAddress).catch(() => null)
      : null;

    const intent = await askAgent(
      prompt,
      initiaAddress,
      currentInventory,
      sessionIdRef.current,
    );

    if (intent.type === "help" || intent.type === "chat") {
      setMessages((current) => [
        ...current,
        createMessage("assistant", intent.message, "info", {
          suggestions: intent.suggestions,
        }),
      ]);
      return;
    }

    if (intent.type === "username") {
      const url = intent.username?.registrationUrl || USERNAME_REGISTRATION_URL;
      setMessages((current) => [
        ...current,
        createMessage("assistant", intent.message, "action", {
          suggestions: intent.suggestions,
        }),
      ]);
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    if (!initiaAddress) {
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          "Connect your wallet first, then I can query inventory or send Move transactions for you.",
          "info",
        ),
      ]);
      return;
    }

    if (intent.type === "query") {
      const inventory =
        currentInventory ?? (await fetchInventory(initiaAddress));
      await triggerInventoryRefresh();

      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          [intent.message, "", formatInventoryMessage(inventory)].join("\n"),
          "info",
          { suggestions: intent.suggestions },
        ),
      ]);
      return;
    }

    if (intent.type === "revenue") {
      const stats = getRevenueStats();
      const lines = [
        intent.message,
        "",
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Total Transactions | **${stats.totalTx}** |`,
        `| Est. Revenue | **${stats.estimatedRevenue.toFixed(4)} INIT** |`,
        `| Tx/min (active) | **${stats.txPerMinute.toFixed(1)}** |`,
      ];
      if (Object.keys(stats.breakdown).length > 0) {
        lines.push("", "**By action:**");
        for (const [action, count] of Object.entries(stats.breakdown)) {
          lines.push(`- ${action}: ${count}`);
        }
      }
      setMessages((current) => [
        ...current,
        createMessage("assistant", lines.join("\n"), "info", {
          suggestions: intent.suggestions || ["Mint 5 shards", "Check inventory"],
        }),
      ]);
      return;
    }

    if (intent.type === "bridge") {
      try {
        openInitDepositFlow({
          openDeposit,
          recipientAddress: initiaAddress,
        });
      } catch (cause) {
        throw new Error(
          "Failed to open the Interwoven Bridge deposit flow.",
          { cause },
        );
      }

      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = window.setTimeout(() => {
        void onRequestInventoryRefresh?.();
      }, BRIDGE_STATUS_REFRESH_DELAY_MS);

      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          formatBridgeExecutionMessage(intent),
          "action",
          { suggestions: intent.suggestions },
        ),
      ]);
      return;
    }

    const results = await executeAgentActions({
      actions: intent.actions,
      initiaAddress,
      requestTxSync,
      autoSignEnabled,
    });

    for (const r of results) {
      onTransactionLog?.({
        action: formatActionName(r.action.functionName),
        txHash: r.txHash,
        timestamp: new Date(),
      });
    }

    await triggerInventoryRefresh();

    setMessages((current) => [
      ...current,
      createMessage(
        "assistant",
        formatExecutionMessage(intent, results, autoSignEnabled),
        "action",
        { suggestions: intent.suggestions },
      ),
    ]);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const prompt = draft.trim();
    if (!prompt || isThinking) {
      return;
    }

    setMessages((current) => [...current, createMessage("user", prompt)]);
    setDraft("");
    setIsThinking(true);

    try {
      await handleAgentPrompt(prompt);
    } catch (error) {
      console.error("Agent execution failed", error);
      setMessages((current) => [
        ...current,
        createMessage("assistant", formatExecutionError(error), "error"),
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  // Find suggestions from the last assistant message
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const activeSuggestions =
    !isThinking && lastAssistantMsg?.suggestions?.length > 0
      ? lastAssistantMsg.suggestions
      : [];

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">AI Chat</p>
          <h2>Mission Console</h2>
        </div>
        <div className="panel-header__actions">
          <button
            type="button"
            className="clear-chat-button"
            onClick={handleClearHistory}
            title="Clear conversation"
          >
            <RotateCcw size={14} />
          </button>
          <span
            className={`panel-chip ${autoSignEnabled ? "panel-chip--active" : ""}`}
          >
            <span
              className={`chip-dot ${autoSignEnabled ? "chip-dot--on" : ""}`}
            />
            {autoSignEnabled ? "Auto-sign ready" : "Manual approval"}
          </span>
        </div>
      </div>

      <div className="message-list">
        {messages.map((message) => {
          const isAssistant = message.role === "assistant";
          const variantClass =
            isAssistant && message.variant !== "info"
              ? `message--${message.variant}`
              : "";

          return (
            <article
              key={message.id}
              className={`message message--${message.role} ${variantClass} message-enter`}
            >
              <div className="message-avatar">
                {isAssistant ? <Bot size={16} /> : <User size={16} />}
              </div>
              <div className="message-bubble">
                <div className="message-meta">
                  <span className="message-role">
                    {isAssistant ? "Agent" : displayUsername || "You"}
                  </span>
                  <span className="message-time">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                {isAssistant ? (
                  <div className="markdown-body">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{message.content}</p>
                )}
              </div>
            </article>
          );
        })}

        {isThinking && (
          <article className="message message--assistant message-enter">
            <div className="message-avatar">
              <Bot size={16} />
            </div>
            <div className="message-bubble message-bubble--thinking">
              <div className="message-meta">
                <span className="message-role">Agent</span>
              </div>
              <div className="thinking-row">
                <div className="thinking-dots">
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                </div>
                <span>Processing onchain action\u2026</span>
              </div>
            </div>
          </article>
        )}

        <div ref={endRef} />
      </div>

      {activeSuggestions.length > 0 && (
        <div className="suggestion-bar">
          {activeSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="suggestion-chip"
              onClick={() => handleSuggestionClick(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form className="composer" onSubmit={handleSubmit}>
        <input
          className="composer-input"
          type="text"
          placeholder="Try: mint 5 shards, craft relic, or just chat..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={isThinking}
        />
        <button
          type="submit"
          className="send-button"
          disabled={!draft.trim() || isThinking}
        >
          <SendHorizontal size={16} />
        </button>
      </form>
    </section>
  );
}
