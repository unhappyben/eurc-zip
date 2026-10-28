import { useCallback, useEffect, useMemo, useState } from "react";
import {
  encodeFunctionData,
  encodePacked,
  zeroAddress,
  type Address,
  type Hash,
} from "viem";
import { useAccount, useConfig, useSwitchChain } from "wagmi";
import { getWalletClient } from "wagmi/actions";
import {
  CCTS_ADDRESS,
  EURC_TOKEN_ID,
  MESSAGE_TRANSMITTER_ADDRESS,
  ZERO_BYTES32,
  erc20Abi,
  fetchFeeQuote,
  fetchIrisMessage,
  getNetwork,
  getPublicClient,
  messageTransmitterAbi,
  serviceAbi,
  type TransferDelivery,
  type TransferSpeed,
} from "../lib/cctp";
import type { RouteInfo } from "./useRoutes";

const STORAGE_KEY = "eurc-zip-transfers-v1";

export type TransferStatus =
  | "preparing"
  | "approving"
  | "burning"
  | "attesting"
  | "readyToMint"
  | "minting"
  | "complete"
  | "error";

export type TransferRecord = {
  id: string;
  sourceDomain: number;
  destinationDomain: number;
  amount: string;
  recipient: Address;
  speed: TransferSpeed;
  delivery: TransferDelivery;
  feeNative: string;
  status: TransferStatus;
  createdAt: number;
  updatedAt: number;
  approvalTx?: Hash;
  sourceTx?: Hash;
  destinationTx?: Hash;
  destinationStartBalance?: string;
  attestation?: string;
  message?: string;
  batched?: boolean;
  error?: string;
};

type StartParams = {
  route: RouteInfo;
  amount: bigint;
  recipient: Address;
  speed: TransferSpeed;
  delivery: TransferDelivery;
};

function loadRecords(): TransferRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as TransferRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/reject|denied|cancel/i.test(message)) return "Wallet request cancelled. No new transaction was sent.";
  if (/insufficient funds/i.test(message)) return "Insufficient native currency for the CCTP fee and network gas.";
  return message.length > 320 ? `${message.slice(0, 320)}…` : message;
}

export function useBridgeTransfer() {
  const { address } = useAccount();
  const config = useConfig();
  const { switchChainAsync } = useSwitchChain();
  const [records, setRecords] = useState<TransferRecord[]>(loadRecords);
  const [activeId, setActiveId] = useState<string | null>(() => {
    const incomplete = loadRecords().find(
      (record) => record.sourceTx && !["complete", "error"].includes(record.status),
    );
    return incomplete?.id ?? null;
  });
  const [overlayOpen, setOverlayOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const active = useMemo(
    () => records.find((record) => record.id === activeId) ?? null,
    [records, activeId],
  );

  const update = useCallback((id: string, patch: Partial<TransferRecord>) => {
    setRecords((current) =>
      current.map((record) =>
        record.id === id ? { ...record, ...patch, updatedAt: Date.now() } : record,
      ),
    );
  }, []);

  const start = useCallback(
    async ({ route, amount, recipient, speed, delivery }: StartParams) => {
      if (!address) throw new Error("Connect a wallet first");
      const id = crypto.randomUUID();
      const source = route.source.network;
      const destination = route.destination.network;
      const sourceDomain = source.domain;
      const destinationDomain = destination.domain;
      const record: TransferRecord = {
        id,
        sourceDomain,
        destinationDomain,
        amount: amount.toString(),
        recipient,
        speed,
        delivery,
        feeNative: "0",
        status: "preparing",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setRecords((current) => [record, ...current]);
      setActiveId(id);
      setOverlayOpen(true);

      try {
        const sourceClient = getPublicClient(sourceDomain);
        const destinationClient = getPublicClient(destinationDomain);
        const [sourceToken, tokenManager, destinationToken] = await Promise.all([
          sourceClient.readContract({
            address: CCTS_ADDRESS,
            abi: serviceAbi,
            functionName: "resolveTokenAddress",
            args: [EURC_TOKEN_ID],
          }),
          sourceClient.readContract({
            address: CCTS_ADDRESS,
            abi: serviceAbi,
            functionName: "resolveTokenManager",
            args: [EURC_TOKEN_ID],
          }),
          destinationClient.readContract({
            address: CCTS_ADDRESS,
            abi: serviceAbi,
            functionName: "resolveTokenAddress",
            args: [EURC_TOKEN_ID],
          }),
        ]);

        const expectedSource = route.source.deployment?.tokenAddress;
        const expectedManager = route.source.deployment?.tokenManagerAddress;
        const expectedDestination = route.destination.deployment?.tokenAddress;
        if (
          (expectedSource && sourceToken.toLowerCase() !== expectedSource.toLowerCase()) ||
          (expectedManager && tokenManager.toLowerCase() !== expectedManager.toLowerCase()) ||
          (expectedDestination &&
            destinationToken.toLowerCase() !== expectedDestination.toLowerCase())
        ) {
          throw new Error("Circle registry and onchain contract addresses disagree. Transfer stopped.");
        }

        const [eurcBalance, allowance] = await Promise.all([
          sourceClient.readContract({
            address: sourceToken,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
          }),
          sourceClient.readContract({
            address: sourceToken,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, tokenManager],
          }),
        ]);
        if (eurcBalance < amount) throw new Error("Your source EURC balance changed before signing.");

        await switchChainAsync({ chainId: source.chain.id });
        const wallet = await getWalletClient(config, { chainId: source.chain.id });
        const needsApproval = allowance < amount;
        let batched = false;

        if (needsApproval) {
          try {
            const capabilities = await wallet.getCapabilities({ chainId: source.chain.id });
            batched = ["supported", "ready"].includes(capabilities.atomic?.status ?? "");
          } catch {
            batched = false;
          }
        }

        if (needsApproval && !batched) {
          update(id, { status: "approving" });
          const approvalTx = await wallet.writeContract({
            address: sourceToken,
            abi: erc20Abi,
            functionName: "approve",
            args: [tokenManager, amount],
            account: address,
            chain: source.chain,
          });
          update(id, { approvalTx });
          const approvalReceipt = await sourceClient.waitForTransactionReceipt({ hash: approvalTx });
          if (approvalReceipt.status !== "success") throw new Error("EURC approval transaction failed.");
        }

        const quote = await fetchFeeQuote({
          amount,
          sourceDomain,
          destinationDomain,
          recipient,
          speed,
          delivery,
        });
        const fee = BigInt(quote.feeTotalAmount);
        const nativeBalance = await sourceClient.getBalance({ address });
        if (nativeBalance < fee) {
          throw new Error(`You need ${quote.feeTotalAmount} wei plus gas on ${source.shortName}.`);
        }
        const destinationStartBalance = await destinationClient.readContract({
          address: destinationToken,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [recipient],
        });
        update(id, {
          feeNative: fee.toString(),
          destinationStartBalance: destinationStartBalance.toString(),
          batched,
        });

        const transferArgs = [
          EURC_TOKEN_ID,
          amount,
          destinationDomain,
          encodePacked(["address"], [recipient]),
          ZERO_BYTES32,
          speed === "fast" ? 1000 : 2000,
          { signedQuote: quote.signedQuote, refundAddress: zeroAddress },
          false,
          "0x",
        ] as const;

        if (needsApproval && batched) {
          update(id, { status: "approving" });
          const approveData = encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [tokenManager, amount],
          });
          const transferData = encodeFunctionData({
            abi: serviceAbi,
            functionName: "crossChainTransfer",
            args: transferArgs,
          });
          const { id: batchId } = await wallet.sendCalls({
            account: address,
            chain: source.chain,
            calls: [
              { to: sourceToken, data: approveData },
              { to: CCTS_ADDRESS, data: transferData, value: fee },
            ],
            forceAtomic: true,
          });
          update(id, { status: "burning" });
          const result = await wallet.waitForCallsStatus({
            id: batchId,
            timeout: 120_000,
            throwOnFailure: true,
          });
          const receipts = result.receipts ?? [];
          const sourceTx = receipts.at(-1)?.transactionHash;
          if (!sourceTx) throw new Error("The wallet did not return a source transaction hash.");
          update(id, {
            sourceTx,
            approvalTx: receipts.length > 1 ? receipts[0].transactionHash : undefined,
            status: "attesting",
          });
        } else {
          update(id, { status: "burning" });
          await sourceClient.simulateContract({
            address: CCTS_ADDRESS,
            abi: serviceAbi,
            functionName: "crossChainTransfer",
            args: transferArgs,
            account: address,
            value: fee,
          });
          const sourceTx = await wallet.writeContract({
            address: CCTS_ADDRESS,
            abi: serviceAbi,
            functionName: "crossChainTransfer",
            args: transferArgs,
            account: address,
            chain: source.chain,
            value: fee,
          });
          update(id, { sourceTx });
          const receipt = await sourceClient.waitForTransactionReceipt({ hash: sourceTx });
          if (receipt.status !== "success") throw new Error("The source transfer transaction failed.");
          update(id, { status: "attesting" });
        }
      } catch (error) {
        update(id, { status: "error", error: friendlyError(error) });
      }
    },
    [address, config, switchChainAsync, update],
  );

  useEffect(() => {
    if (!active?.sourceTx || !["burning", "attesting", "readyToMint", "minting"].includes(active.status)) return;
    let cancelled = false;
    let checking = false;

    const check = async () => {
      if (checking || cancelled) return;
      checking = true;
      try {
        if (active.status === "burning") {
          const receipt = await getPublicClient(active.sourceDomain).waitForTransactionReceipt({
            hash: active.sourceTx!,
          });
          if (!cancelled) {
            update(active.id, {
              status: receipt.status === "success" ? "attesting" : "error",
              error: receipt.status === "success" ? undefined : "The source transaction failed.",
            });
          }
          return;
        }
        if (active.status === "attesting") {
          const message = await fetchIrisMessage(active.sourceDomain, active.sourceTx!);
          if (message?.status === "complete" && !cancelled) {
            const manualReady = active.delivery === "manual" && message.message && message.attestation;
            if (active.delivery !== "manual" || manualReady) {
              update(active.id, {
                status: active.delivery === "manual" ? "readyToMint" : "minting",
                attestation: message.attestation,
                message: message.message,
              });
            }
          }
          return;
        }
        if (["readyToMint", "minting"].includes(active.status) && active.destinationStartBalance !== undefined) {
          const destinationToken = await getPublicClient(active.destinationDomain).readContract({
            address: CCTS_ADDRESS,
            abi: serviceAbi,
            functionName: "resolveTokenAddress",
            args: [EURC_TOKEN_ID],
          });
          const balance = await getPublicClient(active.destinationDomain).readContract({
            address: destinationToken,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [active.recipient],
          });
          const expected = BigInt(active.destinationStartBalance) + BigInt(active.amount);
          if (balance >= expected && !cancelled) update(active.id, { status: "complete" });
        }
      } catch {
        // RPC and attestation polling recover on the next interval.
      } finally {
        checking = false;
      }
    };

    void check();
    const interval = window.setInterval(() => void check(), 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [active, update]);

  const claimMint = useCallback(
    async (record: TransferRecord) => {
      if (!address) {
        update(record.id, { status: "error", error: "Connect the wallet that will pay destination gas." });
        return;
      }
      if (!record.message || !record.attestation) {
        update(record.id, { status: "error", error: "Circle’s message and attestation are not ready yet." });
        return;
      }
      const destination = getNetwork(record.destinationDomain);
      try {
        await switchChainAsync({ chainId: destination.chain.id });
        const wallet = await getWalletClient(config, { chainId: destination.chain.id });
        const client = getPublicClient(record.destinationDomain);
        update(record.id, { status: "minting", error: undefined });
        await client.simulateContract({
          address: MESSAGE_TRANSMITTER_ADDRESS,
          abi: messageTransmitterAbi,
          functionName: "receiveMessage",
          args: [record.message as `0x${string}`, record.attestation as `0x${string}`],
          account: address,
        });
        const destinationTx = await wallet.writeContract({
          address: MESSAGE_TRANSMITTER_ADDRESS,
          abi: messageTransmitterAbi,
          functionName: "receiveMessage",
          args: [record.message as `0x${string}`, record.attestation as `0x${string}`],
          account: address,
          chain: destination.chain,
        });
        update(record.id, { destinationTx });
        const receipt = await client.waitForTransactionReceipt({ hash: destinationTx });
        if (receipt.status !== "success") throw new Error("The destination mint transaction failed.");
        update(record.id, { status: "complete" });
      } catch (error) {
        update(record.id, { status: "error", error: friendlyError(error) });
      }
    },
    [address, config, switchChainAsync, update],
  );

  const openRecord = useCallback(
    (record: TransferRecord) => {
      setActiveId(record.id);
      setOverlayOpen(true);
      if (record.status === "error" && record.sourceTx) {
        const canClaim = record.delivery === "manual" && record.message && record.attestation;
        update(record.id, { status: canClaim ? "readyToMint" : "attesting", error: undefined });
      }
    },
    [update],
  );

  const closeActive = useCallback(() => setOverlayOpen(false), []);
  const resetActive = useCallback(() => {
    setOverlayOpen(false);
    setActiveId(null);
  }, []);

  return {
    records,
    active,
    overlayOpen,
    start,
    claimMint,
    openRecord,
    closeActive,
    resetActive,
  };
}

export function transferNetwork(record: TransferRecord, side: "source" | "destination") {
  return getNetwork(side === "source" ? record.sourceDomain : record.destinationDomain);
}
