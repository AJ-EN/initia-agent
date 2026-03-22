import { AccAddress, RESTClient } from "@initia/initia.js";

import { appConfig } from "./config.js";

const restClient = new RESTClient(appConfig.restUrl, {
  chainId: appConfig.chainId,
});

export const EMPTY_INVENTORY = Object.freeze({
  shards: 0,
  gems: 0,
  relics: 0,
  legendaryRelics: 0,
});

export const inventoryStructTag = `${AccAddress.toHex(
  appConfig.moduleAddress,
)}::agent_actions::Inventory`;

function toCount(value) {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isMissingInventory(error) {
  const message = String(
    error?.response?.data?.message || error?.message || "",
  ).toLowerCase();

  return message.includes("not found") || message.includes("resource");
}

export async function fetchInventory(initiaAddress) {
  if (!initiaAddress) {
    return EMPTY_INVENTORY;
  }

  try {
    const resource = await restClient.move.resource(
      initiaAddress,
      inventoryStructTag,
    );
    const data = resource?.data ?? {};

    return {
      shards: toCount(data.shards),
      gems: toCount(data.gems),
      relics: toCount(data.relics),
      legendaryRelics: toCount(data.legendary_relics),
    };
  } catch (error) {
    if (isMissingInventory(error)) {
      return EMPTY_INVENTORY;
    }

    throw error;
  }
}
