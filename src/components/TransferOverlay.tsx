import { ArrowUpRight, Check, Minus, RotateCcw, X } from "lucide-react";
import type { CSSProperties } from "react";
import {
  explorerTx,
  formatEurc,
  formatNative,
  shortAddress,
} from "../lib/cctp";
import { transferNetwork, type TransferRecord } from "../hooks/useBridgeTransfer";
import { nativeFeeUsd, useEthPrice } from "../hooks/useEthPrice";

const stages = ["Approve", "Burn", "Attest", "Mint"];

const statusCopy = {
  preparing: ["Getting everything ready", "Resolving Circle’s contracts and preparing your wallet."],
  approving: ["Let the coin roll", "Approve the exact EURC amount in your wallet."],
  burning: ["EURC is moving", "Confirm the transfer. This burns EURC on the source network."],
  attesting: ["Circle is checking the ticket", "Waiting for Circle’s Iris attestation."],
  readyToMint: ["Ready to mint", "Attestation received. Switch to the destination and pay only network gas."],
  minting: ["Nearly there", "The destination mint is being processed."],
  complete: ["Your EURC has landed", "Native EURC arrived at the destination address."],
  error: ["The coin hit a bump", "Review the message below. Your transaction history is preserved."],
} as const;

export function TransferOverlay({
  record,
  open,
  onClose,
  onReset,
  onResume,
  onMint,
}: {
  record: TransferRecord | null;
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  onResume: (record: TransferRecord) => void;
  onMint: (record: TransferRecord) => void;
}) {
  const ethPrice = useEthPrice();
  if (!open || !record) return null;
  const source = transferNetwork(record, "source");
  const destination = transferNetwork(record, "destination");
  const feeUsd = nativeFeeUsd(BigInt(record.feeNative), source.chain.nativeCurrency.symbol, ethPrice);
  const stageIndex =
    record.status === "preparing" || record.status === "approving"
      ? 0
      : record.status === "burning"
        ? 1
        : record.status === "attesting"
          ? 2
          : record.status === "error"
            ? record.sourceTx
              ? 2
              : record.approvalTx
                ? 1
                : 0
            : 3;
  const [title, description] = statusCopy[record.status];

  return (
    <div className="transfer-overlay" role="dialog" aria-modal="true" aria-labelledby="transfer-title">
      <header className="transfer-header">
        <div className="wordmark"><img src="/eurc.png" alt="" />eurc.zip</div>
        <button className="icon-button" aria-label="Minimise transfer" onClick={onClose}>
          <Minus size={22} />
        </button>
      </header>
      <main className="transfer-main">
        <p className="eyebrow">{source.shortName.toUpperCase()} · {formatEurc(BigInt(record.amount), 6)} EURC</p>
        <h2 id="transfer-title">{title}<span className="violet-full-stop">.</span></h2>
        <p className="transfer-description">{description}</p>

        <div className={`rolling-stage ${record.status === "complete" ? "is-complete" : ""}`}>
          <div className="rolling-track" />
          <div
            className="rolling-coin"
            style={{ "--stage-index": stageIndex } as CSSProperties}
            aria-hidden="true"
          >
            <div className="rolling-coin-rotor"><img src="/eurc.png" alt="" /></div>
            {record.status === "complete" && <span className="coin-check"><Check size={26} /></span>}
          </div>
          <div className="rolling-stops">
            {stages.map((stage, index) => (
              <div
                className={`rolling-stop ${index < stageIndex || record.status === "complete" ? "done" : ""} ${index === stageIndex ? "current" : ""}`}
                key={stage}
              >
                <span>{index < stageIndex || record.status === "complete" ? <Check size={14} /> : index + 1}</span>
                {stage}
              </div>
            ))}
          </div>
        </div>

        <div className="transfer-receipt">
          <div><span>Route</span><strong>{source.shortName} → {destination.shortName}</strong></div>
          <div><span>Recipient</span><strong title={record.recipient}>{shortAddress(record.recipient)}</strong></div>
          <div><span>Delivery</span><strong>{record.delivery === "manual" ? "Self mint" : "Circle mint"}</strong></div>
          <div><span>CCTP fee</span><strong>{formatNative(BigInt(record.feeNative))} {source.chain.nativeCurrency.symbol}{feeUsd && <span className="fee-usd"> · {feeUsd}</span>}</strong></div>
        </div>

        {record.approvalTx && record.approvalTx !== record.sourceTx && (
          <a className="transaction-link" href={explorerTx(source, record.approvalTx)} target="_blank" rel="noreferrer">
            Approval transaction <ArrowUpRight size={16} />
          </a>
        )}
        {record.sourceTx && (
          <a className="transaction-link" href={explorerTx(source, record.sourceTx)} target="_blank" rel="noreferrer">
            Source transaction <ArrowUpRight size={16} />
          </a>
        )}
        {record.destinationTx && (
          <a className="transaction-link" href={explorerTx(destination, record.destinationTx)} target="_blank" rel="noreferrer">
            Destination mint transaction <ArrowUpRight size={16} />
          </a>
        )}
        {record.batched && <p className="batch-note">Approval and transfer batched with EIP-5792.</p>}
        {record.error && <p className="transfer-error">{record.error}</p>}
        <div className="transfer-actions">
          {record.status === "readyToMint" && (
            <button className="primary-button" onClick={() => onMint(record)}>Mint on {destination.shortName} <ArrowUpRight size={17} /></button>
          )}
          {record.status === "error" && record.sourceTx && (
            <button className="primary-button" onClick={() => onResume(record)}>
              <RotateCcw size={17} /> Resume monitoring
            </button>
          )}
          {record.status === "complete" ? (
            <button className="primary-button" onClick={onReset}>Zip another amount</button>
          ) : (
            <button className="text-button" onClick={onClose}>Keep running in the background</button>
          )}
        </div>
      </main>
      <button className="transfer-exit" onClick={onReset} aria-label="Close transfer view"><X size={18} /></button>
    </div>
  );
}
