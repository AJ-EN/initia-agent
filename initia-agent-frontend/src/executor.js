import { MsgExecute } from "@initia/initia.proto/initia/move/v1/tx";

import { appConfig } from "./config.js";

const MOVE_EXECUTE_TYPE_URL = "/initia.move.v1.MsgExecute";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildMoveExecuteMessage(initiaAddress, action) {
  return {
    typeUrl: MOVE_EXECUTE_TYPE_URL,
    value: MsgExecute.fromPartial({
      sender: initiaAddress,
      moduleAddress: appConfig.moduleAddress,
      moduleName: appConfig.moduleName,
      functionName: action.functionName,
      typeArgs: [],
      args: [],
    }),
  };
}

export async function executeAgentActions({
  actions,
  initiaAddress,
  requestTxSync,
  autoSignEnabled,
}) {
  if (!initiaAddress) {
    throw new Error("Connect your wallet before sending onchain actions.");
  }

  const results = [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];

    // Wait before sending each transaction after the first to avoid sequence mismatch
    if (i > 0) {
      await sleep(3000);
    }

    try {
      const txHash = await requestTxSync({
        chainId: appConfig.chainId,
        messages: [buildMoveExecuteMessage(initiaAddress, action)],
        ...(autoSignEnabled
          ? {
              autoSign: true,
              feeDenom: appConfig.nativeDenom,
              preferredFeeDenom: appConfig.nativeDenom,
            }
          : {}),
      });

      results.push({
        action,
        txHash,
      });

      // Wait after successful tx so the chain can update the account sequence
      if (i < actions.length - 1) {
        await sleep(2000);
      }
    } catch (cause) {
      const error = new Error(
        `Failed while executing \`${action.functionName}\` on ${appConfig.chainId}.`,
        { cause },
      );
      error.partialResults = results;
      error.failedAction = action;
      throw error;
    }
  }

  // Wait before returning so inventory refresh queries see the latest state
  await sleep(2000);

  return results;
}
