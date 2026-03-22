const NUMBER_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const HELP_TEXT = [
  "Here are the commands I can handle locally right now:",
  "",
  "- `mint shard`, `mine shard`, `get shard`",
  "- `mint 5 shards`",
  "- `mint gem`, `mine gem`, `get gem`",
  "- `craft relic`, `make relic`, `forge relic`",
  "- `upgrade relic`, `make legendary`, `forge legendary`",
  "- `check inventory`, `what do I have`, `my items`, `status`",
].join("\n");

const ACTION_DEFINITIONS = [
  {
    functionName: "upgrade_relic",
    singular: "legendary relic",
    plural: "legendary relics",
    presentTense: "upgrade relic",
    match(normalized) {
      return (
        /\bupgrade\s+\d*\s*relics?\b/.test(normalized) ||
        /\b(?:make|forge)\s+\d*\s*legendary(?:\s+relics?)?\b/.test(normalized)
      );
    },
  },
  {
    functionName: "craft_relic",
    singular: "relic",
    plural: "relics",
    presentTense: "craft relic",
    match(normalized) {
      return (
        !normalized.includes("legendary") &&
        /\b(?:craft|make|forge)\s+\d*\s*relics?\b/.test(normalized)
      );
    },
  },
  {
    functionName: "mint_shard",
    singular: "shard",
    plural: "shards",
    presentTense: "mint shard",
    match(normalized) {
      return /\b(?:mint|mine|get)\s+\d*\s*shards?\b/.test(normalized);
    },
  },
  {
    functionName: "mint_gem",
    singular: "gem",
    plural: "gems",
    presentTense: "mint gem",
    match(normalized) {
      return /\b(?:mint|mine|get)\s+\d*\s*gems?\b/.test(normalized);
    },
  },
];

function normalizeMessage(message) {
  return message.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function extractQuantity(normalized) {
  const numericMatch = normalized.match(/\b(\d+)\b/);
  if (numericMatch) {
    return Math.max(1, Number.parseInt(numericMatch[1], 10));
  }

  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(normalized)) {
      return value;
    }
  }

  return 1;
}

function pluralize(quantity, singular, plural) {
  return quantity === 1 ? singular : plural;
}

function buildActionPlan(definition, quantity) {
  const itemLabel = pluralize(quantity, definition.singular, definition.plural);

  return {
    type: "action",
    actions: Array.from({ length: quantity }, (_, index) => ({
      id: `${definition.functionName}-${index + 1}`,
      functionName: definition.functionName,
      label: definition.presentTense,
      moduleName: "agent_actions",
    })),
    message:
      quantity === 1
        ? `I parsed that as: ${definition.presentTense}.`
        : `I parsed that as: ${definition.presentTense} ${quantity} times to create ${quantity} ${itemLabel}.`,
  };
}

function buildInventoryQuery(walletAddress) {
  return {
    type: "query",
    actions: [],
    message: walletAddress
      ? `Checking inventory for \`${walletAddress}\`.`
      : "Connect your wallet first, then I can check your inventory.",
  };
}

export function formatActionName(functionName) {
  switch (functionName) {
    case "mint_shard":
      return "mint shard";
    case "mint_gem":
      return "mint gem";
    case "craft_relic":
      return "craft relic";
    case "upgrade_relic":
      return "upgrade relic";
    default:
      return functionName.replaceAll("_", " ");
  }
}

const BACKEND_URL = "http://localhost:3001";

export async function askAgent(message, walletAddress, inventory) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, walletAddress, inventory }),
    });

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const data = await response.json();

    return {
      type: data.type || "chat",
      actions: data.actions || [],
      message: data.message || "Done.",
    };
  } catch (err) {
    console.warn("AI backend unreachable, falling back to local parsing:", err.message);
    return parseAgentMessage(message, walletAddress);
  }
}

export function parseAgentMessage(message, walletAddress) {
  const normalized = normalizeMessage(message);

  if (
    /\bhelp\b/.test(normalized) ||
    normalized.includes("what can you do") ||
    normalized.includes("commands")
  ) {
    return {
      type: "help",
      actions: [],
      message: HELP_TEXT,
    };
  }

  if (
    normalized.includes("check inventory") ||
    normalized.includes("what do i have") ||
    normalized.includes("my items") ||
    normalized === "status" ||
    normalized.includes("inventory")
  ) {
    return buildInventoryQuery(walletAddress);
  }

  const quantity = extractQuantity(normalized);
  const matchingAction = ACTION_DEFINITIONS.find((definition) =>
    definition.match(normalized),
  );

  if (matchingAction) {
    return buildActionPlan(matchingAction, quantity);
  }

  return {
    type: "help",
    actions: [],
    message: [
      "I couldn't map that request to an onchain action yet.",
      "",
      HELP_TEXT,
    ].join("\n"),
  };
}

export { HELP_TEXT };
