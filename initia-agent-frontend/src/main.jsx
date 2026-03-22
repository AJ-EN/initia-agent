import { Buffer } from "buffer";

if (!window.Buffer) {
  window.Buffer = Buffer;
}

if (!window.process) {
  window.process = { env: { NODE_ENV: "development" } };
}

import React from "react";
import ReactDOM from "react-dom/client";
import "@initia/interwovenkit-react/styles.css";
import { injectStyles, InterwovenKitProvider, TESTNET } from "@initia/interwovenkit-react";
import InterwovenKitStyles from "@initia/interwovenkit-react/styles.js";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import { appConfig, customChain } from "./config.js";
import "./index.css";

// Inject styles for the widget
injectStyles(InterwovenKitStyles);

const queryClient = new QueryClient();
const wagmiConfig = createConfig({
  chains: [mainnet],
  transports: { [mainnet.id]: http() },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <InterwovenKitProvider
          {...TESTNET}
          defaultChainId={appConfig.chainId}
          customChain={customChain}
          customChains={[customChain]}
          enableAutoSign={true}
        >
          <App />
        </InterwovenKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
