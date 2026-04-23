# InitiaAgent

**The execution layer for on-chain AI agents.**

> INITIATE Hackathon · Track: **AI** · VM: **Move** · Rollup: `initia-agent-1` · Deployed address: `0x37bedf9964326b808fbfe344edb0d564c1213dda`

---

## One-line pitch

InitiaAgent lets a user speak intent in English to an AI agent that executes a burst of Move transactions on its own Initia appchain — one approval, zero popups, every gas unit captured as revenue to the chain owner.

## The problem we're solving

AI agents can *decide* what to do on-chain. They can't *execute* it cleanly. Today every on-chain AI agent fails on one of three axes:

| Failure mode | Why it breaks |
|---|---|
| **Pop wallet per step** | Destroys the agent UX — "natural-language trading" becomes "click approve 12 times" |
| **Leak a private key to a backend** | Security liability, non-starter for real money |
| **Rent a closed session-key SDK** | Someone else captures the fee revenue and owns the relationship |

So in practice AI on blockchains today is mostly read-only (dashboards, summaries) or single-purpose (one bot, one function). The moment you want an agent that *chains* actions, you hit the wall.

## Why Initia unlocks this — and nothing else does

InitiaAgent is the working proof that Initia is the one stack where all four pieces exist natively:

1. **Own your rollup** → every agent transaction is *your* sequencer revenue, not leakage to a shared chain.
2. **InterwovenKit auto-signing** → one session approval, then the agent fires silent batches with scoped permissions (`/initia.move.v1.MsgExecute`).
3. **Interwoven Bridge** → users onboard from any Initia chain inside the chat itself, no "go bridge on another site first" drop-off.
4. **Initia Usernames (`.init`)** → the agent addresses users by name, not hex — the difference between a tool and a product.

Take any of these four away and the pattern collapses back into one of the failure modes above. That's the wedge.

## What we actually built

- A **Move appchain** (`initia-agent-1`) with a custom `agent_actions` module, 13 unit tests covering happy paths and expected-failure cases.
- A **Claude-powered backend** (`tool_use` API) that parses natural-language intent into structured `MsgExecute` calls with account sequence handling.
- A **React frontend** on InterwovenKit 2.4.6 with real-time inventory, animated counters, crafting progress bars, transaction activity log, and a Revenue panel that shows fees captured live.
- **All three native features** integrated end-to-end, not stubbed:
  - Auto-sign with explicit permission scoping and `feeDenom` for a truly headless flow.
  - `openBridge({ srcChainId: "initiation-2", srcDenom: "uinit" })` triggered by chat intent or direct button.
  - `.init` names resolved from the L1 registry via `rest.move.view`, cached, rendered across header / chat / inventory.

The *specific* demo — crafting shards → gems → relics → legendary relics — is chosen because it exercises the exact primitive the pattern unlocks: **batched sequential state mutations**. The same pattern transfers 1:1 to on-chain trading bots, NFT market-making, DeFi position rebalancing, on-chain game NPCs, or any "describe what you want, agent does the 7 transactions" product.

## Market & competitive position

| Competitor | What they offer | Where InitiaAgent wins |
|---|---|---|
| **Privy / Dynamic / Crossmint** | Embedded wallets + policy-gated tx signing (mostly EVM) | You rent their SDK; we own the whole stack and the fees |
| **Banana Wallet** (Starknet) | Session keys for account abstraction | Starknet-locked; no bridge or identity layer |
| **Syndicate Transaction Cloud** | Gasless/policy-controlled sending infra | Infrastructure, not AI-native; no identity, no bridge |
| **Phala Network agent wallets** | TEE-based agent signing | Heavy infra, not a product surface; no owned economics |
| **BONKbot / agentkit (Solana)** | AI trading bots | Single-purpose; fees go to Solana, not you |

**Target user (v1):** developers building vertical AI agents that need on-chain execution — trading bots, DeFi auto-managers, on-chain NPCs, agent-operated DAOs. They clone this repo, swap `agent_actions.move` for their domain module, and ship.

**Target user (v2):** end users of those verticals who speak intent to the agent and never see a wallet popup after the first session approval.

**Revenue model:** sequencer fees on the owned rollup. Every agent action — and agents generate orders of magnitude more transactions than human users — is captured fee revenue. The Revenue panel in the UI makes this concrete on-screen.

**Why now:** Claude `tool_use` and equivalent structured-output APIs are ~18 months old; session-key UX on rollups is ~6 months old; Initia mainnet opens the economic model. The intersection is brand new.

## Implementation detail

- **Custom implementation**: Claude `tool_use` parses natural language → maps to Move entry functions (`mint_shard`, `mint_gem`, `craft_relic`, `upgrade_relic`) → backend emits structured action list → frontend batches them into `MsgExecute` calls signed by the auto-sign session. Inventory analysis and crafting recommendations are computed from live on-chain state.
- **Native feature integration**:
  1. **Auto-Signing** — `autoSign.enable(chainId)` in `App.jsx` creates a session for `initia-agent-1`; `requestTxSync` in `executor.js` passes `autoSign: true` + explicit `feeDenom: "umin"` for a headless flow.
  2. **Interwoven Bridge** — `openBridge` triggered by chat ("deposit 1 INIT from L1") or the bridge panel; uses `srcChainId: "initiation-2"` to avoid local-indexer resolution issues.
  3. **Initia Usernames (`.init`)** — L1 username registry lookup cached client-side; register flow available via chat ("call me ayush") or direct link.

## Project structure

- `initia-agent-contracts/` — Move package for the `agent_actions` module
- `initia-agent-backend/` — Express + Claude server that converts natural language into structured actions
- `initia-agent-frontend/` — React + InterwovenKit frontend (chat, inventory, bridge, revenue views)
- `.initia/submission.json` — hackathon submission metadata

## Key paths

- Core Move logic: `initia-agent-contracts/sources/agent_actions.move`
- Auto-sign integration: `initia-agent-frontend/src/App.jsx`, `executor.js`
- Interwoven Bridge UI: `initia-agent-frontend/src/Bridge.jsx`
- Initia Usernames utility: `initia-agent-frontend/src/username.js`
- Chat execution flow: `initia-agent-frontend/src/Chat.jsx`
- Claude backend bridge: `initia-agent-backend/server.js`
- Revenue attribution panel: `initia-agent-frontend/src/Revenue.jsx`

## How to run locally

1. Complete the Initia appchain setup: follow https://docs.initia.xyz/hackathon/get-started to launch a Move appchain.
2. Deploy the contract:

   ```bash
   cd initia-agent-contracts
   minitiad move deploy --build --language-version=2.1 --named-addresses initia_agent=<YOUR_HEX_ADDRESS> --from gas-station --keyring-backend test --chain-id initia-agent-1 --gas auto --gas-adjustment 1.4 --yes
   ```

3. Start the backend:

   ```bash
   cd initia-agent-backend
   cp .env.example .env
   npm install
   npm start
   ```

   Add your `ANTHROPIC_API_KEY` to `.env` before starting the server.

4. Start the frontend:

   ```bash
   cd initia-agent-frontend
   npm install
   npm run dev
   ```

   Open http://localhost:5173 in your browser.

## Demo flow

1. Connect an Initia wallet to the local appchain frontend.
2. Bridge INIT from Initia L1 into the appchain — either from the bridge panel or by asking the AI `deposit 1 INIT from L1`.
3. Enable auto-signing once for `initia-agent-1`.
4. Register an Initia Username by asking the agent `call me ayush`, or click "Register Username" in the inventory panel.
5. Ask the agent to perform a batch — `mint 5 shards, craft a relic, and upgrade it` — and watch multiple transactions fire silently.
6. Inventory, crafting readiness, .init identity, and the Revenue panel update live.

## Judge quick-verify (5 minutes)

1. **Contract is live** — the `agent_actions` module is published at `0x37bedf9964326b808fbfe344edb0d564c1213dda` on `initia-agent-1`. Query inventory state directly:

   ```bash
   minitiad query move view \
     0x37bedf9964326b808fbfe344edb0d564c1213dda \
     agent_actions \
     inventory_of \
     --args 'address:<any_user_bech32>' \
     --node http://localhost:26657
   ```

2. **Native features are wired, not stubbed**:
   - Auto-signing: `autoSign.enable(chainId)` bound to the appchain in `App.jsx`; transactions pass `autoSign: true` + explicit `feeDenom` for a headless flow in `executor.js`
   - Interwoven Bridge: `openBridge({ srcChainId: "initiation-2", srcDenom: "uinit" })` — see `Bridge.jsx`
   - Initia Usernames: L1 registry lookup via `rest.move.view` — see `username.js`

3. **Tests pass** — `cd initia-agent-contracts && minitiad move test` (13 Move unit tests covering mint/craft/upgrade happy paths + 6 expected-failure cases).

4. **End-to-end reproducible** — follow "How to run locally" above; the demo video linked in `.initia/submission.json` walks through the exact same flow.

## Submission metadata

- Track: `AI`
- Rollup chain ID: `initia-agent-1`
- VM: `move`
- Native features in the app: `auto-signing`, `Interwoven Bridge`, `Initia Usernames`
- Deployed address: `0x37bedf9964326b808fbfe344edb0d564c1213dda`
