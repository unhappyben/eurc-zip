import type { ReactNode } from "react";
import type { NetworkDeployment } from "../hooks/useRoutes";
import type { TransferDelivery, TransferSpeed } from "../lib/cctp";
import { ChainSelect } from "./ChainSelect";

type BridgeDesignProps = {
  amount: string;
  onAmountChange: (amount: string) => void;
  sourceDomain: number;
  destinationDomain: number;
  sourceOptions: NetworkDeployment[];
  destinationOptions: NetworkDeployment[];
  onSourceChange: (domain: number) => void;
  onDestinationChange: (domain: number) => void;
  onSwap: () => void;
  action: ReactNode;
  recipientControl: ReactNode;
  speed: TransferSpeed;
  onSpeedChange: (speed: TransferSpeed) => void;
  delivery: TransferDelivery;
  onDeliveryChange: (delivery: TransferDelivery) => void;
  feeContent: ReactNode;
  balanceContent: ReactNode;
};

export function BridgeDesign({
  amount,
  onAmountChange,
  sourceDomain,
  destinationDomain,
  sourceOptions,
  destinationOptions,
  onSourceChange,
  onDestinationChange,
  onSwap,
  action,
  recipientControl,
  speed,
  onSpeedChange,
  delivery,
  onDeliveryChange,
  feeContent,
  balanceContent,
}: BridgeDesignProps) {
  return (
    <section className="sketch-bridge" aria-label="Build your EURC transfer">
      <div className="sketch-amount">
        <input
          aria-label="Amount of EURC"
          inputMode="decimal"
          maxLength={14}
          value={amount}
          placeholder="0"
          onChange={(event) => {
            if (/^\d*\.?\d{0,6}$/.test(event.target.value)) onAmountChange(event.target.value);
          }}
          style={{ width: `${Math.max(1, (amount || "0").length)}ch` }}
        />
        <span className="sketch-token">eurc</span>
      </div>

      <div className="sketch-networks">
        <ChainSelect label="Source network" value={sourceDomain} options={sourceOptions} onChange={onSourceChange} />
        <button className="sketch-arrow" onClick={onSwap} aria-label="Swap source and destination">→</button>
        <ChainSelect label="Destination network" value={destinationDomain} options={destinationOptions} onChange={onDestinationChange} />
      </div>

      <div className="sketch-recipient">{recipientControl}</div>
      <div className="sketch-review">{action}</div>

      <div className="sketch-toggles">
        <div className="sketch-toggle sketch-control" aria-label="Transfer speed">
          <button className={speed === "standard" ? "active" : ""} onClick={() => onSpeedChange("standard")}>standard</button>
          <span>/</span>
          <button className={speed === "fast" ? "active" : ""} onClick={() => onSpeedChange("fast")}>fast</button>
        </div>
        <div className="sketch-toggle sketch-control" aria-label="Destination delivery">
          <button className={delivery === "manual" ? "active" : ""} onClick={() => onDeliveryChange("manual")}>self</button>
          <span>/</span>
          <button className={delivery === "forwarded" ? "active" : ""} onClick={() => onDeliveryChange("forwarded")}>auto</button>
        </div>
      </div>

      <div className="sketch-fee" aria-live="polite">{feeContent}</div>
      <div className="sketch-balances">{balanceContent}</div>
      <div className="sketch-public-good">public good · no added fees</div>
    </section>
  );
}
