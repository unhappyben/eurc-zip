import { ArrowUpRight, Check, Minus, RotateCcw } from "lucide-react";
import type { CSSProperties } from "react";
import {
  explorerTx,
  formatEurc,
  formatNative,
  shortAddress,
} from "../lib/cctp";
import { transferNetwork, type TransferRecord } from "../hooks/useBridgeTransfer";
import { nativeFeeUsd, useEthPrice } from "../hooks/useEthPrice";

const stages = ["approve", "burn", "attest", "mint"];

const statusCopy = {
  preparing: ["preparing transfer", "Resolving Circle’s contracts and your wallet."],
  approving: ["approve eurc", "Approve the exact amount in your wallet."],
  burning: ["burning eurc", "Confirm the source transaction in your wallet."],
  attesting: ["waiting for attestation", "Circle is signing the transfer."],
  readyToMint: ["ready to mint", "Attestation received. Mint on the destination and pay only network gas."],
  minting: ["minting eurc", "Waiting for the destination transaction."],
  complete: ["transfer complete", "Native EURC arrived at the destination address."],
  error: ["transfer needs attention", "Review the message below. Your transfer state is saved."],
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
    <div className="transfer-overlay final-transfer" role="dialog" aria-modal="true" aria-labelledby="transfer-title">
      <header className="transfer-header">
        <div className="wordmark"><img src="/eurc.png" alt="" />eurc.zip</div>
        <button className="icon-button" aria-label="Minimise transfer" onClick={onClose}><Minus size={21} /></button>
      </header>
      <main className="transfer-main final-transfer-main">
        <p className="transfer-context">{source.shortName.toLowerCase()} · {formatEurc(BigInt(record.amount), 6)} eurc</p>
        <h2 id="transfer-title">{title}</h2>
        <p className="transfer-description">{description}</p>

        <div className={`rolling-stage ${record.status === "complete" ? "is-complete" : ""}`}>
          <div className="rolling-track" />
          <div className="rolling-coin" style={{ "--stage-index": stageIndex } as CSSProperties} aria-hidden="true">
            <div className="rolling-coin-rotor"><img src="/eurc.png" alt="" /></div>
            {record.status === "complete" && <span className="coin-check"><Check size={26} /></span>}
          </div>
          <div className="rolling-stops">
            {stages.map((stage, index) => (
              <div className={`rolling-stop ${index < stageIndex || record.status === "complete" ? "done" : ""} ${index === stageIndex ? "current" : ""}`} key={stage}>
                <span>{index < stageIndex || record.status === "complete" ? <Check size={14} /> : index + 1}</span>
                {stage}
              </div>
            ))}
          </div>
        </div>

        <dl className="transfer-facts">
          <div><dt>route</dt><dd>{source.shortName.toLowerCase()} → {destination.shortName.toLowerCase()}</dd></div>
          <div><dt>recipient</dt><dd title={record.recipient}>{shortAddress(record.recipient)}</dd></div>
          <div><dt>delivery</dt><dd>{record.speed} · {record.delivery === "manual" ? "self" : "auto"}</dd></div>
          <div><dt>fee</dt><dd>{formatNative(BigInt(record.feeNative))} {source.chain.nativeCurrency.symbol}{feeUsd && ` · ${feeUsd}`}</dd></div>
        </dl>

        <div className="transfer-links">
          {record.approvalTx && record.approvalTx !== record.sourceTx && <a className="transaction-link" href={explorerTx(source, record.approvalTx)} target="_blank" rel="noreferrer">approval transaction <ArrowUpRight size={14} /></a>}
          {record.sourceTx && <a className="transaction-link" href={explorerTx(source, record.sourceTx)} target="_blank" rel="noreferrer">source transaction <ArrowUpRight size={14} /></a>}
          {record.destinationTx && <a className="transaction-link" href={explorerTx(destination, record.destinationTx)} target="_blank" rel="noreferrer">destination transaction <ArrowUpRight size={14} /></a>}
        </div>
        {record.batched && <p className="batch-note">approval + transfer batched with eip-5792</p>}
        {record.error && <p className="transfer-error">{record.error}</p>}
        <div className="transfer-actions">
          {record.status === "readyToMint" && <button className="transfer-primary" onClick={() => onMint(record)}>mint on {destination.shortName.toLowerCase()} <ArrowUpRight size={17} /></button>}
          {record.status === "error" && record.sourceTx && <button className="transfer-primary" onClick={() => onResume(record)}><RotateCcw size={16} /> resume monitoring</button>}
          {record.status === "complete" ? <button className="transfer-primary" onClick={onReset}>new transfer</button> : <button className="text-button" onClick={onClose}>run in background</button>}
        </div>
      </main>
    </div>
  );
}
