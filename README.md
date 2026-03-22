# Initia Hackathon Submission

- **Project Name**: InitiaAgent

## Project Overview

InitiaAgent is an AI-powered onchain control room built on its own Initia appchain. Users interact with an AI agent powered by Claude through natural language to execute Move smart contract actions, including minting resources, crafting items, and upgrading relics, all without manual wallet approvals thanks to Initia's auto-signing feature. Every transaction generates sequencer revenue, demonstrating a sustainable revenue model for AI-powered blockchain applications.

## Implementation Detail

- **The Custom Implementation**: An AI chat agent that parses natural language intent using Claude's `tool_use` API, maps it to Move smart contract function calls (`mint_shard`, `mint_gem`, `craft_relic`, `upgrade_relic`), executes them sequentially with proper account sequence handling, and provides intelligent inventory analysis with crafting recommendations. The backend Express server bridges Claude AI with onchain execution, while the frontend provides real-time inventory tracking with animated counters, crafting progress bars, and a transaction activity log.
- **The Native Feature**: Auto-signing creates a frictionless experience where users approve a session once, then the AI agent executes all subsequent transactions silently without wallet popups. This is essential for an AI agent use case because the agent needs to execute multiple sequential actions, like minting 5 shards, without interrupting the user with approval dialogs for each transaction.

## Project Structure

- `initia-agent-contracts/`: Move smart contract package for the `agent_actions` module
- `initia-agent-backend/`: Express + Claude backend that converts natural language into structured actions
- `initia-agent-frontend/`: React frontend with InterwovenKit integration, auto-signing, inventory views, and chat UX
- `.initia/submission.json`: Submission metadata for the hackathon deliverable

## Key Paths

- Core Move logic: `initia-agent-contracts/sources/agent_actions.move`
- Auto-sign frontend integration: `initia-agent-frontend/src/App.jsx`
- Chat execution flow: `initia-agent-frontend/src/Chat.jsx`
- Claude backend bridge: `initia-agent-backend/server.js`

## How to Run Locally

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

## Demo Flow

1. Connect an Initia wallet to the local appchain frontend.
2. Enable auto-signing once for the `initia-agent-1` appchain.
3. Ask the agent to perform actions like `mint 5 shards`, `craft relic`, `upgrade relic`, or `check inventory`.
4. Watch the frontend update with real-time balances, crafting readiness, and recent transaction history.

## Submission Metadata

- Rollup chain ID: `initia-agent-1`
- VM: `move`
- Native feature used: `auto-signing`
- Deployed address: `0x37bedf9964326b808fbfe344edb0d564c1213dda`
