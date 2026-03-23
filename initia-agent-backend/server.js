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

const SYSTEM_PROMPT = `You are InitiaAgent, an AI assistant that helps users manage their onchain inventory on the Initia blockchain. The user's appchain is ${APPCHAIN_CHAIN_ID} and Initia L1 is ${L1_CHAIN_ID}. You can mint shards, mint gems, craft relics (costs 2 shards + 1 gem), and upgrade relics to legendary (costs 3 relics). You can also help users deposit INIT (${INIT_DENOM}) from Initia L1 into their appchain wallet by opening the built-in Interwoven Bridge deposit flow. When the user asks to deposit INIT from L1, bridge tokens to the appchain, or fund their appchain account from L1, use the deposit_from_l1 tool. Do not use minting, crafting, or upgrade tools for bridge or funding requests. If the user includes an amount, pass it through. If they do not include an amount, you may omit it and tell them they can choose the amount in the bridge modal. Be friendly, concise, and explain what you're doing. If the user's inventory doesn't have enough resources, warn them before attempting. The user's current inventory is provided in each message.`;

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
];

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
      `Current inventory: ${inventory.shards} shards, ${inventory.gems} gems, ${inventory.relics} relics, ${inventory.legendaryRelics} legendary relics`,
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

function buildDefaultReply({ bridge, actions, hasInventoryCheck }) {
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

app.post("/api/chat", async (req, res) => {
  try {
    const { message, walletAddress, inventory } = req.body;

    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: [
        {
          role: "user",
          content: buildUserMessage(message, walletAddress, inventory),
        },
      ],
    });

    const textBlocks = response.content.filter((b) => b.type === "text");
    const toolUses = response.content.filter((b) => b.type === "tool_use");
    const replyText =
      textBlocks.map((b) => b.text).join("\n") || "";

    if (toolUses.length === 0) {
      return res.json({ message: replyText, actions: [], type: "chat" });
    }

    const hasInventoryCheck = toolUses.some(
      (tu) => tu.name === "check_inventory",
    );
    const bridge = extractBridgeRequest(toolUses);
    const actionToolUses = toolUses.filter(
      (tu) => tu.name !== "check_inventory" && tu.name !== "deposit_from_l1",
    );
    const actions = expandActions(actionToolUses);

    let type = "chat";
    if (bridge) {
      type = "bridge";
    } else if (actions.length > 0) {
      type = "action";
    } else if (hasInventoryCheck) {
      type = "query";
    }

    return res.json({
      message:
        replyText || buildDefaultReply({ bridge, actions, hasInventoryCheck }),
      actions,
      bridge,
      type,
    });
  } catch (err) {
    console.error("Error calling Anthropic API:", err.message);
    return res.status(500).json({ error: "Failed to process chat request" });
  }
});

app.listen(PORT, () => {
  console.log(`initia-agent-backend running on http://localhost:${PORT}`);
});
