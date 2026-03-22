import "dotenv/config";
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true }));
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are InitiaAgent, an AI assistant that helps users manage their onchain inventory on the Initia blockchain. You can mint shards, mint gems, craft relics (costs 2 shards + 1 gem), and upgrade relics to legendary (costs 3 relics). When the user asks you to do something, use the appropriate tool. Be friendly, concise, and explain what you're doing. If the user's inventory doesn't have enough resources, warn them before attempting. The user's current inventory is provided in each message.`;

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
];

function buildUserMessage(message, walletAddress, inventory) {
  const parts = [`User message: ${message}`];
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
    const actionToolUses = toolUses.filter(
      (tu) => tu.name !== "check_inventory",
    );
    const actions = expandActions(actionToolUses);

    let type = "chat";
    if (actions.length > 0) {
      type = "action";
    } else if (hasInventoryCheck) {
      type = "query";
    }

    return res.json({ message: replyText, actions, type });
  } catch (err) {
    console.error("Error calling Anthropic API:", err.message);
    return res.status(500).json({ error: "Failed to process chat request" });
  }
});

app.listen(PORT, () => {
  console.log(`initia-agent-backend running on http://localhost:${PORT}`);
});
