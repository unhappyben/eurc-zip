import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  CCTS_ADDRESS,
  EURC_TOKEN_ID,
  erc20Abi,
  getPublicClient,
  serviceAbi,
  type EurcToken,
} from "../lib/cctp";
import type { NetworkDeployment } from "./useRoutes";

export type WalletBalance = {
  domain: number;
  eurc: bigint | null;
  native: bigint | null;
};

export function useWalletBalances(
  token: EurcToken | undefined,
  networks: NetworkDeployment[],
) {
  const { address } = useAccount();
  const enabledNetworks = networks.filter((network) => network.status === "enabled");
  const networkKey = enabledNetworks.map((network) => network.network.domain).join(",");

  const query = useQuery({
    queryKey: ["wallet-eurc-balances", address, networkKey, token?.tokenId],
    enabled: Boolean(address && token && enabledNetworks.length),
    refetchInterval: 30_000,
    queryFn: async (): Promise<WalletBalance[]> =>
      Promise.all(
        enabledNetworks.map(async ({ network }) => {
          const client = getPublicClient(network.domain);
          try {
            const tokenAddress = await client.readContract({
              address: CCTS_ADDRESS,
              abi: serviceAbi,
              functionName: "resolveTokenAddress",
              args: [EURC_TOKEN_ID],
            });
            const [eurc, native] = await Promise.all([
              client.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [address!],
              }),
              client.getBalance({ address: address! }),
            ]);
            return { domain: network.domain, eurc, native };
          } catch {
            return { domain: network.domain, eurc: null, native: null };
          }
        }),
      ),
  });

  const total = query.data?.reduce((sum, item) => sum + (item.eurc ?? 0n), 0n) ?? 0n;
  return { ...query, address, balances: query.data ?? [], total };
}
