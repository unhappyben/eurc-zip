import { ArrowLeft, ArrowRight, X } from "lucide-react";
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
    <div className="review-screen" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <header className="transfer-header">
        <div className="wordmark"><img src="/eurc.png" alt="" />eurc.zip</div>
        <button className="icon-button" aria-label="Close review" onClick={onClose}><X size={20} /></button>
      </header>
      <main className="review-main-sketch">
        <div className="review-amount-large" id="review-title">{formatEurc(amount, 6)}<span className="sketch-token">eurc</span></div>
        <div className="review-route-large">
          <div className="review-network">{source.shortName.toLowerCase()}</div>
          <span>→</span>
          <div className="review-network">{destination.shortName.toLowerCase()}</div>
        </div>
        <dl className="review-detail-row">
          <div><dt>recipient</dt><dd title={recipient}>{shortAddress(recipient)}</dd></div>
          <div><dt>speed</dt><dd>{speed}</dd></div>
          <div><dt>delivery</dt><dd>{delivery === "forwarded" ? "circle mint" : "self mint"}</dd></div>
        </dl>
        <div className="review-fee-large">
          {delivery === "forwarded" ? "CCTP + forwarded mint" : "CCTP · destination gas separate"} {formatNative(BigInt(quote.feeTotalAmount))} {source.chain.nativeCurrency.symbol}{feeUsd && ` · ${feeUsd}`}
          <details>
            <summary>fee items</summary>
            {quote.items.map((item, index) => (
              <div key={`${item.type}-${index}`}><span>{item.type.toLowerCase()}</span><strong>{formatNative(BigInt(item.amount))} {source.chain.nativeCurrency.symbol}</strong></div>
            ))}
          </details>
        </div>
        <button className="review-confirm-large" onClick={onConfirm}>confirm in wallet <ArrowRight size={21} /></button>
        <button className="review-back" onClick={onClose}><ArrowLeft size={13} /> back</button>
        <p className="review-note">real eurc · exact approval · no added fees{delivery === "manual" ? ` · you pay ${destination.shortName.toLowerCase()} gas` : ""}</p>
      </main>
    </div>
  );
}
