import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  CCTS_ADDRESS,
  NETWORKS,
  EURC_TOKEN_ID,
  fetchEurcToken,
  fetchFastAllowance,
  getPublicClient,
  serviceAbi,
  type NetworkMeta,
  type TokenDeployment,
} from "../lib/cctp";

export type NetworkDeployment = {
  network: NetworkMeta;
  deployment?: TokenDeployment;
  status: "enabled" | "disabled" | "not-deployed";
};

export type RouteStatus =
  | "live"
  | "checking"
  | "disabled"
  | "not-deployed"
  | "untrusted"
  | "unknown";

export type RouteInfo = {
  id: string;
  source: NetworkDeployment;
  destination: NetworkDeployment;
  status: RouteStatus;
};

export function useRoutes() {
  const tokenQuery = useQuery({
    queryKey: ["iris-eurc-token"],
    queryFn: fetchEurcToken,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  const allowanceQuery = useQuery({
    queryKey: ["iris-eurc-fast-allowance"],
    queryFn: fetchFastAllowance,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const networks = useMemo<NetworkDeployment[]>(
    () =>
      NETWORKS.map((network) => {
        const deployment = tokenQuery.data?.deployments.find(
          (item) => item.domainId === network.domain,
        );
        return {
          network,
          deployment,
          status: !deployment
            ? "not-deployed"
            : deployment.enabled && network.serviceDeployed
              ? "enabled"
              : "disabled",
        };
      }),
    [tokenQuery.data],
  );

  const eligiblePairs = useMemo(
    () =>
      networks.flatMap((source) =>
        networks
          .filter(
            (destination) =>
              destination.network.domain !== source.network.domain &&
              source.status === "enabled" &&
              destination.status === "enabled",
          )
          .map((destination) => [source.network.domain, destination.network.domain] as const),
      ),
    [networks],
  );
  const pairKey = eligiblePairs.map(([source, destination]) => `${source}-${destination}`).join(",");

  const trustQuery = useQuery({
    queryKey: ["cctp-trusted-routes", pairKey],
    enabled: eligiblePairs.length > 0,
    staleTime: 120_000,
    queryFn: async () =>
      Object.fromEntries(
        await Promise.all(
          eligiblePairs.map(async ([source, destination]) => {
            try {
              const trusted = await getPublicClient(source).readContract({
                address: CCTS_ADDRESS,
                abi: serviceAbi,
                functionName: "isTrustedDomain",
                args: [destination],
              });
              return [`${source}-${destination}`, trusted] as const;
            } catch {
              return [`${source}-${destination}`, "error"] as const;
            }
          }),
        ),
      ) as Record<string, boolean | "error">,
  });

  const routes = useMemo<RouteInfo[]>(
    () =>
      networks.flatMap((source) =>
        networks
          .filter((destination) => destination.network.domain !== source.network.domain)
          .map((destination) => {
            const id = `${source.network.domain}-${destination.network.domain}`;
            let status: RouteStatus = "live";
            if (source.status === "not-deployed" || destination.status === "not-deployed") {
              status = "not-deployed";
            } else if (source.status === "disabled" || destination.status === "disabled") {
              status = "disabled";
            } else if (trustQuery.isPending) {
              status = "checking";
            } else {
              const trusted = trustQuery.data?.[id];
              if (trusted === false) status = "untrusted";
              else if (trusted === "error" || trusted === undefined) status = "unknown";
            }
            return { id, source, destination, status };
          }),
      ),
    [networks, trustQuery.data, trustQuery.isPending],
  );

  return {
    token: tokenQuery.data,
    tokenQuery,
    allowance: allowanceQuery.data,
    allowanceQuery,
    networks,
    routes,
    liveRoutes: routes.filter((route) => route.status === "live"),
    trustQuery,
  };
}

export function routeByDomains(routes: RouteInfo[], source: number, destination: number) {
  return routes.find(
    (route) =>
      route.source.network.domain === source &&
      route.destination.network.domain === destination,
  );
}

export const eurcTokenKey = EURC_TOKEN_ID;
