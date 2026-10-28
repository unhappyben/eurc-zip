import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { NETWORKS } from "./cctp";

export const wagmiConfig = createConfig({
  chains: NETWORKS.map((network) => network.chain) as [
    (typeof NETWORKS)[number]["chain"],
    ...(typeof NETWORKS)[number]["chain"][],
  ],
  connectors: [injected()],
  transports: Object.fromEntries(
    NETWORKS.map((network) => [network.chain.id, http(network.rpc)]),
  ),
  ssr: false,
});
