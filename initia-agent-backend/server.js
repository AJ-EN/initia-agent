import "dotenv/config";
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
const PORT = process.env.PORT || 3001;
const APPCHAIN_CHAIN_ID = "initia-agent-1";
const L1_CHAIN_ID = "initiation-2";
const INIT_DENOM = "uinit";

app.use(cors({ origin: true }));
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const USERNAME_REGISTRATION_URL = "https://usernames.testnet.initia.xyz";

/* ───────────────────────────────────────────────
   Conversation memory — last 10 exchanges per session
   ─────────────────────────────────────────────── */

const MAX_HISTORY = 10;
const sessionHistories = new Map();

function getHistory(sessionId) {
  if (!sessionId) return [];
  return sessionHistories.get(sessionId) || [];
}

function pushHistory(sessionId, userContent, assistantContent) {
  if (!sessionId) return;
  const history = sessionHistories.get(sessionId) || [];
  history.push(
    { role: "user", content: userContent },
    { role: "assistant", content: assistantContent },
  );
  // Keep only the last MAX_HISTORY exchanges (2 messages each)
  while (history.length > MAX_HISTORY * 2) {
    history.shift();
  }
  sessionHistories.set(sessionId, history);
}

function clearHistory(sessionId) {
  if (sessionId) sessionHistories.delete(sessionId);
}

/* ───────────────────────────────────────────────
   Crafting cost reference
   ─────────────────────────────────────────────── */

const COSTS = {
  mint_shard: { cost: {}, gain: { shards: 1 } },
  mint_gem: { cost: {}, gain: { gems: 1 } },
  craft_relic: { cost: { shards: 2, gems: 1 }, gain: { relics: 1 } },
  upgrade_relic: { cost: { relics: 3 }, gain: { legendaryRelics: 1 } },
};

const EMOJI = { shards: "\u26a1", gems: "\ud83d\udc8e", relics: "\ud83d\udd2e", legendaryRelics: "\ud83d\udc51" };

function formatCostSummary(actions) {
  const totalCost = {};
  const totalGain = {};
  for (const a of actions) {
    const info = COSTS[a.functionName];
    if (!info) continue;
    for (const [k, v] of Object.entries(info.cost)) {
      totalCost[k] = (totalCost[k] || 0) + v;
    }
    for (const [k, v] of Object.entries(info.gain)) {
      totalGain[k] = (totalGain[k] || 0) + v;
    }
  }

  const costParts = Object.entries(totalCost)
    .map(([k, v]) => `${v}${EMOJI[k] || k}`)
    .join(" + ");
  const gainParts = Object.entries(totalGain)
    .map(([k, v]) => `${v}${EMOJI[k] || k}`)
    .join(" + ");

  if (!costParts && !gainParts) return "";
  if (!costParts) return `Gained: ${gainParts}`;
  return `Spent: ${costParts} \u2192 Got: ${gainParts}`;
}

function formatNewBalance(inventory, actions) {
  if (!inventory) return "";
  const inv = { ...inventory };
  for (const a of actions) {
    const info = COSTS[a.functionName];
    if (!info) continue;
    for (const [k, v] of Object.entries(info.cost)) inv[k] = (inv[k] || 0) - v;
    for (const [k, v] of Object.entries(info.gain)) inv[k] = (inv[k] || 0) + v;
  }
  return `New balance: ${inv.shards}\u26a1 ${inv.gems}\ud83d\udc8e ${inv.relics}\ud83d\udd2e ${inv.legendaryRelics}\ud83d\udc51`;
}

/* ───────────────────────────────────────────────
   System prompt — personality-driven
   ─────────────────────────────────────────────── */

const SYSTEM_PROMPT = `You are InitiaAgent, a witty and strategic AI companion for the Initia blockchain. Think of yourself as a game companion who tracks resources and suggests optimal strategies. Your appchain is ${APPCHAIN_CHAIN_ID} and Initia L1 is ${L1_CHAIN_ID}.

PERSONALITY:
- Be concise but warm. Use a confident, slightly playful tone.
- Celebrate milestones: first craft, first legendary, big mints.
- Use resource emojis inline: \u26a1 shards, \ud83d\udc8e gems, \ud83d\udd2e relics, \ud83d\udc51 legendary relics.
- Handle casual conversation naturally ("how are you", "what is Initia", "explain this app").

GAME MECHANICS (always reference these):
- Mint: creates 1 shard or 1 gem per call (free, unlimited).
- Craft relic: costs 2\u26a1 + 1\ud83d\udc8e \u2192 produces 1\ud83d\udd2e.
- Upgrade relic: costs 3\ud83d\udd2e \u2192 produces 1\ud83d\udc51.
- Full legendary pipeline: 6\u26a1 + 3\ud83d\udc8e \u2192 3\ud83d\udd2e \u2192 1\ud83d\udc51.

STRATEGY — always do these:
1. BEFORE executing costly actions, warn about the cost and confirm the user has enough resources. Example: "That'll cost 2\u26a1 + 1\ud83d\udc8e. You have 5\u26a1 and 3\ud83d\udc8e — plenty! Proceeding."
2. AFTER executing actions, suggest the logical next move. Examples:
   - After minting shards/gems: "You now have enough to craft a relic. Want me to craft one?"
   - After crafting relics: "3 relics unlocks a legendary upgrade. You have X — need Y more."
   - After upgrading: "Legendary forged! Want to keep going or check your collection?"
3. Include a "suggestions" array in your thinking — I'll extract it. Format each suggestion as a short imperative phrase the user can click to execute (e.g. "Craft a relic", "Mint 2 gems").

SUGGESTIONS FORMAT:
After your text response, if you have suggested next actions, end your response with a line that starts with "SUGGESTIONS:" followed by a pipe-separated list. Example:
SUGGESTIONS:Craft a relic|Mint 3 shards|Check inventory
Only include 1-3 relevant suggestions. Omit the line entirely if no suggestions make sense.

BRIDGE / FUNDING:
- When the user asks to deposit INIT from L1, bridge tokens, or fund their appchain, use the deposit_from_l1 tool.
- Do not use minting/crafting tools for bridge requests.

USERNAMES:
- When the user asks to register a username, set their name, or says "call me X", use the register_username tool.

IMPORTANT:
- The user's current inventory is provided with each message. Always check it before acting.
- If resources are insufficient, tell them exactly what they need and suggest minting.
- You have full conversation history — reference previous actions naturally.
- Keep responses under 4 sentences plus the cost/balance line when executing actions.`;

/* ───────────────────────────────────────────────
   Tools
   ─────────────────────────────────────────────── */

const TOOLS = [
  {
    name: "mint_shard",
    description:
      "Mint shards for the user. Each call mints one shard. Call multiple times (or specify count) to mint more.",
    input_schema: {
      type: "object",
      properties: {
        count: {
          type: "number",
          description: "Number of shards to mint. Defaults to 1.",
          default: 1,
        },
      },
      required: [],
    },
  },
  {
    name: "mint_gem",
    description:
      "Mint gems for the user. Each call mints one gem. Call multiple times (or specify count) to mint more.",
    input_schema: {
      type: "object",
      properties: {
        count: {
          type: "number",
          description: "Number of gems to mint. Defaults to 1.",
          default: 1,
        },
      },
      required: [],
    },
  },
  {
    name: "craft_relic",
    description:
      "Craft a relic. Costs 2 shards and 1 gem per relic. The user must have enough resources.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "upgrade_relic",
    description:
      "Upgrade a relic to legendary status. Costs 3 relics. The user must have enough relics.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "check_inventory",
    description: "Query the user's current onchain inventory.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "deposit_from_l1",
    description:
      "Open the built-in Interwoven Bridge deposit flow so the user can deposit INIT from Initia L1 into their appchain wallet.",
    input_schema: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description:
            "Suggested amount of INIT to deposit from L1, if the user specified one.",
        },
      },
      required: [],
    },
  },
  {
    name: "register_username",
    description:
      "Open the Initia Usernames registration portal so the user can claim a .init username for their wallet address.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "The desired username (without .init suffix), if the user specified one.",
        },
      },
      required: [],
    },
  },
];

/* ───────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────── */

function buildUserMessage(message, walletAddress, inventory) {
  const parts = [
    `User message: ${message}`,
    `Initia L1: ${L1_CHAIN_ID}`,
    `Appchain: ${APPCHAIN_CHAIN_ID}`,
  ];
  if (walletAddress) {
    parts.push(`Wallet: ${walletAddress}`);
  }
  if (inventory) {
    parts.push(
      `Current inventory: ${inventory.shards}\u26a1 shards, ${inventory.gems}\ud83d\udc8e gems, ${inventory.relics}\ud83d\udd2e relics, ${inventory.legendaryRelics}\ud83d\udc51 legendary relics`,
    );
  }
  return parts.join("\n");
}

function normalizeBridgeAmount(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return String(parsed);
}

function expandActions(toolUses) {
  const actions = [];
  for (const tu of toolUses) {
    const count = tu.input?.count ?? 1;
    if (
      (tu.name === "mint_shard" || tu.name === "mint_gem") &&
      count > 1
    ) {
      for (let i = 0; i < count; i++) {
        actions.push({
          functionName: tu.name,
          label: tu.name.replace("_", " "),
          moduleName: "agent_actions",
        });
      }
    } else {
      actions.push({
        functionName: tu.name,
        label: tu.name.replace("_", " "),
        moduleName: "agent_actions",
      });
    }
  }
  return actions;
}

function extractUsernameRequest(toolUses) {
  const usernameToolUse = toolUses.find((tu) => tu.name === "register_username");
  if (!usernameToolUse) {
    return null;
  }

  return {
    kind: "register_username",
    name: usernameToolUse.input?.name || null,
    registrationUrl: USERNAME_REGISTRATION_URL,
  };
}

function extractBridgeRequest(toolUses) {
  const bridgeToolUse = toolUses.find((tu) => tu.name === "deposit_from_l1");
  if (!bridgeToolUse) {
    return null;
  }

  return {
    kind: "deposit_from_l1",
    amount: normalizeBridgeAmount(bridgeToolUse.input?.amount),
    denom: INIT_DENOM,
    sourceChainId: L1_CHAIN_ID,
    destinationChainId: APPCHAIN_CHAIN_ID,
  };
}

function extractSuggestions(text) {
  const match = text.match(/SUGGESTIONS:\s*(.+)$/m);
  if (!match) return { cleanText: text, suggestions: [] };
  const suggestions = match[1]
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const cleanText = text.replace(/\n?SUGGESTIONS:.+$/m, "").trim();
  return { cleanText, suggestions };
}

function buildDefaultReply({ bridge, actions, hasInventoryCheck, usernameReq }) {
  if (usernameReq) {
    return usernameReq.name
      ? `I'll open the Initia Usernames portal so you can register **${usernameReq.name}.init**.`
      : `I'll open the Initia Usernames portal so you can claim a .init username.`;
  }

  if (bridge) {
    return bridge.amount
      ? `I'll open Interwoven Bridge so you can deposit ${bridge.amount} INIT from Initia L1 into ${APPCHAIN_CHAIN_ID}.`
      : `I'll open Interwoven Bridge so you can deposit INIT from Initia L1 into ${APPCHAIN_CHAIN_ID}.`;
  }

  if (actions.length > 0) {
    return `I'll handle that on ${APPCHAIN_CHAIN_ID}.`;
  }

  if (hasInventoryCheck) {
    return "Checking your inventory.";
  }

  return "Ready.";
}

/* ───────────────────────────────────────────────
   Routes
   ─────────────────────────────────────────────── */

app.post("/api/chat", async (req, res) => {
  try {
    const { message, walletAddress, inventory, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    const userContent = buildUserMessage(message, walletAddress, inventory);
    const history = getHistory(sessionId);

    const messages = [
      ...history,
      { role: "user", content: userContent },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    const textBlocks = response.content.filter((b) => b.type === "text");
    const toolUses = response.content.filter((b) => b.type === "tool_use");
    const rawReply = textBlocks.map((b) => b.text).join("\n") || "";

    if (toolUses.length === 0) {
      const { cleanText, suggestions } = extractSuggestions(rawReply);
      pushHistory(sessionId, userContent, cleanText);
      return res.json({ message: cleanText, actions: [], type: "chat", suggestions });
    }

    const hasInventoryCheck = toolUses.some(
      (tu) => tu.name === "check_inventory",
    );
    const bridge = extractBridgeRequest(toolUses);
    const usernameReq = extractUsernameRequest(toolUses);
    const actionToolUses = toolUses.filter(
      (tu) =>
        tu.name !== "check_inventory" &&
        tu.name !== "deposit_from_l1" &&
        tu.name !== "register_username",
    );
    const actions = expandActions(actionToolUses);

    let type = "chat";
    if (usernameReq) {
      type = "username";
    } else if (bridge) {
      type = "bridge";
    } else if (actions.length > 0) {
      type = "action";
    } else if (hasInventoryCheck) {
      type = "query";
    }

    const fallbackReply = buildDefaultReply({ bridge, actions, hasInventoryCheck, usernameReq });
    const { cleanText, suggestions } = extractSuggestions(rawReply || fallbackReply);

    const costSummary = actions.length > 0 ? formatCostSummary(actions) : "";
    const balanceLine = actions.length > 0 ? formatNewBalance(inventory, actions) : "";

    pushHistory(sessionId, userContent, cleanText);

    return res.json({
      message: cleanText,
      actions,
      bridge,
      username: usernameReq,
      type,
      suggestions,
      costSummary,
      balanceLine,
    });
  } catch (err) {
    console.error("Error calling Anthropic API:", err.message);
    return res.status(500).json({ error: "Failed to process chat request" });
  }
});

app.post("/api/chat/clear", (req, res) => {
  const { sessionId } = req.body;
  clearHistory(sessionId);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`initia-agent-backend running on http://localhost:${PORT}`);
});
