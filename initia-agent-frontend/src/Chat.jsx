import { useEffect, useRef, useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import ReactMarkdown from "react-markdown";
import { Bot, SendHorizontal, User } from "lucide-react";

import { askAgent, formatActionName } from "./agent.js";
import { appConfig } from "./config.js";
import { executeAgentActions } from "./executor.js";
import { fetchInventory } from "./inventory.js";

function createMessage(role, content, variant = "info") {
  return {
    id:
      globalThis.crypto?.randomUUID?.() ??
      `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    variant,
    timestamp: new Date(),
  };
}

function shortenHash(hash) {
  if (!hash || hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}\u2026${hash.slice(-4)}`;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const initialMessages = [
  createMessage(
    "assistant",
    [
      "**InitiaAgent is live onchain.**",
      "",
      "I can execute Move transactions on your behalf using natural language. Try commands like:",
      "",
      "- `mint 5 shards` \u2014 mint resources",
      "- `craft relic` \u2014 combine shards + gems",
      "- `upgrade relic` \u2014 forge legendary items",
      "- `check inventory` \u2014 view your holdings",
      "- `help` \u2014 see all commands",
    ].join("\n"),
    "info",
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

  return [
    intent.message,
    "",
    `\u2705 Submitted **${results.length}** transaction${results.length === 1 ? "" : "s"} on \`${appConfig.chainId}\`${autoSignEnabled ? " via auto-sign" : ""}`,
    "",
    ...txLines,
  ].join("\n");
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

export default function Chat({ onRequestInventoryRefresh, onTransactionLog }) {
  const { initiaAddress, requestTxSync, autoSign } = useInterwovenKit();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const endRef = useRef(null);
  const refreshTimeoutRef = useRef(null);

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

  async function triggerInventoryRefresh() {
    await onRequestInventoryRefresh?.();

    window.clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = window.setTimeout(() => {
      void onRequestInventoryRefresh?.();
    }, 1200);
  }

  async function handleAgentPrompt(prompt) {
    const currentInventory = initiaAddress
      ? await fetchInventory(initiaAddress).catch(() => null)
      : null;

    const intent = await askAgent(prompt, initiaAddress, currentInventory);

    if (intent.type === "help" || intent.type === "chat") {
      setMessages((current) => [
        ...current,
        createMessage("assistant", intent.message, "info"),
      ]);
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

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">AI Chat</p>
          <h2>Mission Console</h2>
        </div>
        <span
          className={`panel-chip ${autoSignEnabled ? "panel-chip--active" : ""}`}
        >
          <span
            className={`chip-dot ${autoSignEnabled ? "chip-dot--on" : ""}`}
          />
          {autoSignEnabled ? "Auto-sign ready" : "Manual approval"}
        </span>
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
                    {isAssistant ? "Agent" : "You"}
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

      <form className="composer" onSubmit={handleSubmit}>
        <input
          className="composer-input"
          type="text"
          placeholder="Try: mint 5 shards, craft relic, check inventory..."
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
