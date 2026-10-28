import { ArrowRight, ShieldCheck, X } from "lucide-react";
import type { RouteInfo } from "../hooks/useRoutes";
import { nativeFeeUsd, useEthPrice } from "../hooks/useEthPrice";
import {
  formatEurc,
  formatNative,
  shortAddress,
  type FeeQuote,
  type TransferDelivery,
  type TransferSpeed,
} from "../lib/cctp";

export function ReviewDialog({
  route,
  amount,
  recipient,
  speed,
  delivery,
  quote,
  onClose,
  onConfirm,
}: {
  route: RouteInfo;
  amount: bigint;
  recipient: `0x${string}`;
  speed: TransferSpeed;
  delivery: TransferDelivery;
  quote: FeeQuote;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const ethPrice = useEthPrice();
  const source = route.source.network;
  const destination = route.destination.network;
  const feeUsd = nativeFeeUsd(BigInt(quote.feeTotalAmount), source.chain.nativeCurrency.symbol, ethPrice);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button modal-close" aria-label="Close review" onClick={onClose}><X size={20} /></button>
        <p className="eyebrow">{source.shortName.toUpperCase()} · REAL TRANSFER</p>
        <h2 id="review-title">Check your ticket.</h2>
        <div className="review-amount"><img src="/eurc.png" alt="" />{formatEurc(amount, 6)} <span>EURC</span></div>
        <div className="review-route">
          <div><span>From</span><strong>{source.shortName}</strong></div>
          <ArrowRight size={22} />
          <div><span>To</span><strong>{destination.shortName}</strong></div>
        </div>
        <dl className="review-details">
          <div><dt>Recipient</dt><dd title={recipient}>{shortAddress(recipient)}</dd></div>
          <div><dt>Transfer</dt><dd>{speed === "fast" ? "Fast" : "Standard"}</dd></div>
          <div><dt>Delivery</dt><dd>{delivery === "forwarded" ? "Circle mint" : "Self mint on destination"}</dd></div>
          <div><dt>You receive</dt><dd>{formatEurc(amount, 6)} native EURC</dd></div>
          <div><dt>{delivery === "forwarded" ? "CCTP + forwarding fee" : "CCTP fee"}</dt><dd>{formatNative(BigInt(quote.feeTotalAmount))} {source.chain.nativeCurrency.symbol}{feeUsd && <span className="fee-usd"> · {feeUsd}</span>}</dd></div>
        </dl>
        <details className="fee-details">
          <summary>See every fee item</summary>
          {quote.items.map((item, index) => (
            <div key={`${item.type}-${index}`}><span>{item.type}</span><strong>{formatNative(BigInt(item.amount))} {source.chain.nativeCurrency.symbol}</strong></div>
          ))}
        </details>
        <div className="mainnet-warning"><ShieldCheck size={20} /><p>This uses real EURC and real {source.chain.nativeCurrency.symbol}. Approval is exact, never unlimited.{delivery === "manual" ? ` You will switch to ${destination.shortName} and pay its gas to mint after attestation.` : " Circle will handle the destination mint."}</p></div>
        <button className="primary-button full-width confirm-button" onClick={onConfirm}>
          Confirm in wallet <ArrowRight size={18} />
        </button>
        <p className="fine-print centre">A fresh quote is fetched immediately before the transfer.</p>
      </section>
    </div>
  );
}
