import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";

async function fetchEthPrice(): Promise<number> {
  const response = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("ETH price unavailable");
  const body = await response.json() as { data: { amount: string } };
  const price = Number(body.data.amount);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Invalid ETH price");
  return price;
}

export function useEthPrice() {
  return useQuery({
    queryKey: ["coinbase-eth-usd"],
    queryFn: fetchEthPrice,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 2,
  }).data ?? null;
}

export function nativeFeeUsd(value: bigint, symbol: string, ethPrice: number | null): string | null {
  const amount = Number(formatUnits(value, 18));
  const usd = symbol === "USDC" ? amount : symbol === "ETH" && ethPrice ? amount * ethPrice : null;
  if (usd === null || !Number.isFinite(usd)) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: usd < 0.01 ? 4 : 2,
  }).format(usd);
}
