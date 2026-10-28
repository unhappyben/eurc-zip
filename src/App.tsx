import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatUnits, isAddress, type Address } from "viem";
import { useAccount, useConnect } from "wagmi";
import { Activity } from "./components/Activity";
import { BridgeDesign } from "./components/BridgeDesign";
import { ReviewDialog } from "./components/ReviewDialog";
import { RouteBoard } from "./components/RouteBoard";
import { TransferOverlay } from "./components/TransferOverlay";
import { WalletButton } from "./components/WalletButton";
import { useBridgeTransfer } from "./hooks/useBridgeTransfer";
import { nativeFeeUsd, useEthPrice } from "./hooks/useEthPrice";
import { routeByDomains, useRoutes, type RouteInfo } from "./hooks/useRoutes";
import { useWalletBalances } from "./hooks/useWalletBalances";
import {
  fetchFeeQuote,
  formatEurc,
  formatNative,
  parseEurc,
  type TransferDelivery,
  type TransferSpeed,
} from "./lib/cctp";

type View = "bridge" | "routes" | "activity";

export default function App() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending: connecting } = useConnect();
  const {
    token,
    tokenQuery,
    allowance,
    networks,
    routes,
    liveRoutes,
    trustQuery,
  } = useRoutes();
  const { balances, isLoading: balancesLoading } = useWalletBalances(token, networks);
  const transfer = useBridgeTransfer();
  const ethPrice = useEthPrice();
  const [view, setView] = useState<View>("bridge");
  const [sourceDomain, setSourceDomain] = useState(0);
  const [destinationDomain, setDestinationDomain] = useState(6);
  const [amount, setAmount] = useState("1");
  const [speed, setSpeed] = useState<TransferSpeed>("fast");
  const [delivery, setDelivery] = useState<TransferDelivery>("forwarded");
  const [recipient, setRecipient] = useState("");
  const [customRecipient, setCustomRecipient] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const autoSelected = useRef<string | null>(null);

  const route = routeByDomains(routes, sourceDomain, destinationDomain);
  const liveRoute = routeByDomains(liveRoutes, sourceDomain, destinationDomain);
  const sourceOptions = useMemo(
    () => networks.filter((network) => liveRoutes.some((item) => item.source.network.domain === network.network.domain)),
    [networks, liveRoutes],
  );
  const destinationOptions = useMemo(
    () => networks.filter((network) => liveRoutes.some((item) => item.source.network.domain === sourceDomain && item.destination.network.domain === network.network.domain)),
    [networks, liveRoutes, sourceDomain],
  );

  const selectRoute = (next: RouteInfo) => {
    setSourceDomain(next.source.network.domain);
    setDestinationDomain(next.destination.network.domain);
    setView("bridge");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectSource = (domain: number) => {
    setSourceDomain(domain);
    if (!routeByDomains(liveRoutes, domain, destinationDomain)) {
      const next = liveRoutes.find((item) => item.source.network.domain === domain);
      if (next) setDestinationDomain(next.destination.network.domain);
    }
  };

  const swapNetworks = () => {
    const reverse = routeByDomains(liveRoutes, destinationDomain, sourceDomain);
    if (reverse) selectRoute(reverse);
  };

  useEffect(() => {
    if (!liveRoutes.length || liveRoute) return;
    const next = liveRoutes.find((item) => item.source.network.domain === sourceDomain) ?? liveRoutes[0];
    setSourceDomain(next.source.network.domain);
    setDestinationDomain(next.destination.network.domain);
  }, [liveRoutes, liveRoute, sourceDomain]);

  useEffect(() => {
    autoSelected.current = null;
  }, [address]);

  useEffect(() => {
    if (address && !customRecipient) setRecipient(address);
  }, [address, customRecipient]);

  useEffect(() => {
    if (!address || balancesLoading || autoSelected.current === address || !liveRoutes.length) return;
    const sorted = [...balances].sort((a, b) => {
      if (a.eurc === b.eurc) return 0;
      if (a.eurc === null) return 1;
      if (b.eurc === null) return -1;
      return a.eurc > b.eurc ? -1 : 1;
    });
    const richest = sorted.find((balance) => (balance.eurc ?? 0n) > 0n);
    if (richest) {
      const next = liveRoutes.find((item) => item.source.network.domain === richest.domain);
      if (next) {
        setSourceDomain(next.source.network.domain);
        setDestinationDomain(next.destination.network.domain);
      }
    }
    autoSelected.current = address;
  }, [address, balances, balancesLoading, liveRoutes]);

  const amountValue = parseEurc(amount);
  const recipientValid = isAddress(recipient);
  const sourceBalance = balances.find((balance) => balance.domain === sourceDomain);
  const insufficientEurc = Boolean(
    amountValue && sourceBalance?.eurc !== null && sourceBalance?.eurc !== undefined && sourceBalance.eurc < amountValue,
  );
  const quoteEnabled = Boolean(
    view === "bridge" && liveRoute && amountValue && recipientValid && !insufficientEurc,
  );
  const quoteQuery = useQuery({
    queryKey: [
      "mainnet-eurc-quote",
      sourceDomain,
      destinationDomain,
      amountValue?.toString(),
      recipient,
      speed,
      delivery,
    ],
    enabled: quoteEnabled,
    queryFn: () =>
      fetchFeeQuote({
        amount: amountValue!,
        sourceDomain,
        destinationDomain,
        recipient: recipient as Address,
        speed,
        delivery,
      }),
    staleTime: 0,
    refetchInterval: 45_000,
  });
  const insufficientNative = Boolean(
    quoteQuery.data && sourceBalance?.native !== null && sourceBalance?.native !== undefined &&
      sourceBalance.native < BigInt(quoteQuery.data.feeTotalAmount),
  );
  const feeUsd = quoteQuery.data
    ? nativeFeeUsd(BigInt(quoteQuery.data.feeTotalAmount), route?.source.network.chain.nativeCurrency.symbol ?? "", ethPrice)
    : null;

  const openWallet = () => {
    const connector = connectors[0];
    if (connector) connect({ connector });
  };

  const mainAction = () => {
    if (!isConnected) {
      openWallet();
      return;
    }
    if (liveRoute && amountValue && quoteQuery.data && recipientValid) setReviewOpen(true);
  };

  const actionLabel = !isConnected
    ? connecting ? "Waiting for wallet…" : "Connect wallet to zip"
    : !liveRoute
      ? trustQuery.isPending ? "Checking live routes…" : "Choose a live route"
      : !amountValue
        ? "Enter an amount"
        : !recipientValid
          ? "Enter a valid recipient"
          : insufficientEurc
            ? "Not enough EURC"
            : quoteQuery.isPending
              ? "Getting a real quote…"
              : quoteQuery.isError
                ? "Quote unavailable"
                : insufficientNative
                  ? `Not enough ${route?.source.network.chain.nativeCurrency.symbol} for fees`
                  : "Review transfer";

  const actionDisabled = isConnected && Boolean(
    !liveRoute || !amountValue || !recipientValid || insufficientEurc || insufficientNative ||
    quoteQuery.isPending || quoteQuery.isError || !quoteQuery.data || connecting,
  );
  const bridgeActionButton = <button className="bridge-cta" disabled={actionDisabled} onClick={mainAction}><span>{actionLabel}</span><ArrowUpRight size={26} /></button>;
  const recipientControl = <>
    <button className="recipient-toggle" onClick={() => setCustomRecipient((value) => !value)}>{customRecipient ? "send to my wallet" : "send to different address"}<ArrowRight size={14} /></button>
    {customRecipient && <label className="recipient-field"><span>Destination recipient</span><input value={recipient} onChange={(event) => setRecipient(event.target.value.trim())} placeholder="0x…" spellCheck={false} />{recipient && (recipientValid ? <Check className="valid-icon" size={20} /> : <span className="invalid-label">Invalid address</span>)}</label>}
  </>;
  const feeContent = quoteEnabled && quoteQuery.isPending
    ? "pricing live fees…"
    : quoteQuery.isError
      ? "fee quote unavailable"
      : quoteQuery.data
        ? <><span>{delivery === "forwarded" ? "CCTP + forwarded mint" : "CCTP · destination gas separate"}</span> <strong>{formatNative(BigInt(quoteQuery.data.feeTotalAmount))} {route?.source.network.chain.nativeCurrency.symbol}{feeUsd && ` · ${feeUsd}`}</strong></>
        : "live fees appear here";
  const balanceContent = !isConnected ? (
    <button className="wallet-balance-connect" onClick={openWallet}><Sparkles size={13} />connect for wallet balances</button>
  ) : (
    <div className="wallet-balance-buttons">
      {networks.filter((network) => network.status === "enabled").map(({ network }) => {
        const balance = balances.find((item) => item.domain === network.domain);
        return <button className={network.domain === sourceDomain ? "selected" : ""} key={network.domain} onClick={() => selectSource(network.domain)} title={`Use ${network.shortName} as source`}><span>{network.shortName.toLowerCase()}</span><strong>{balance?.eurc == null ? "…" : formatEurc(balance.eurc, 2)}</strong></button>;
      })}
      {sourceBalance?.eurc != null && sourceBalance.eurc > 0n && <button className="wallet-max" onClick={() => setAmount(formatUnits(sourceBalance.eurc!, 6))}>use {route?.source.network.shortName.toLowerCase()} max</button>}
      {balancesLoading && <span>scanning…</span>}
    </div>
  );

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="wordmark" onClick={() => setView("bridge")} aria-label="eurc.zip home">
          <img src="/eurc.png" alt="" />eurc.zip
        </button>
        <div className="header-actions">
          {transfer.active && !transfer.overlayOpen && transfer.active.status !== "complete" && (
            <button className="active-transfer-pill" onClick={() => transfer.openRecord(transfer.active!)}><LoaderCircle size={14} />Transfer {transfer.active.status}</button>
          )}
          <a className="made-by" href="https://x.com/unhappyben" target="_blank" rel="noreferrer">made by ben</a>
          <WalletButton />
        </div>
      </header>

      {view === "bridge" && (
        <main className="bridge-page">
          <BridgeDesign amount={amount} onAmountChange={setAmount} sourceDomain={sourceDomain} destinationDomain={destinationDomain} sourceOptions={sourceOptions} destinationOptions={destinationOptions} onSourceChange={selectSource} onDestinationChange={setDestinationDomain} onSwap={swapNetworks} action={bridgeActionButton} recipientControl={recipientControl} speed={speed} onSpeedChange={setSpeed} delivery={delivery} onDeliveryChange={setDelivery} feeContent={feeContent} balanceContent={balanceContent} />

          <section className="transfer-options">
            <div className="speed-control" aria-label="Transfer speed">
              <button className={speed === "fast" ? "active" : ""} onClick={() => setSpeed("fast")}><span>Fast</span><small>Soft finality</small></button>
              <button className={speed === "standard" ? "active" : ""} onClick={() => setSpeed("standard")}><span>Standard</span><small>Full finality</small></button>
            </div>
            <div className="speed-control delivery-control" aria-label="Destination delivery">
              <button className={delivery === "forwarded" ? "active" : ""} onClick={() => setDelivery("forwarded")}><span>Auto mint</span><small>Circle delivers</small></button>
              <button className={delivery === "manual" ? "active" : ""} onClick={() => setDelivery("manual")}><span>Self mint</span><small>Lower fee</small></button>
            </div>
            <div className="recipient-control">{recipientControl}</div>
          </section>

          <section className="quote-section" aria-live="polite">
            {quoteEnabled && quoteQuery.isPending && amountValue && <div className="quote-loading"><LoaderCircle className="spin" size={17} />Pricing live fees with Circle…</div>}
            {quoteQuery.isError && <div className="quote-error"><strong>Circle could not quote this {speed} transfer.</strong><span>{quoteQuery.error instanceof Error ? quoteQuery.error.message : "Try another route or speed."}</span>{speed === "fast" && <button onClick={() => setSpeed("standard")}>Try Standard instead <ArrowRight size={14} /></button>}</div>}
            {quoteQuery.data && amountValue && (
              <div className="quote-ready">
                <div><span>{delivery === "forwarded" ? "CCTP + forwarded mint" : "CCTP · destination gas separate"}</span><strong>{formatNative(BigInt(quoteQuery.data.feeTotalAmount))} {route?.source.network.chain.nativeCurrency.symbol}{feeUsd && <span className="fee-usd"> · {feeUsd}</span>}</strong></div>
                <div><span>Destination receives</span><strong>{formatEurc(amountValue, 6)} native EURC</strong></div>
                <details><summary>Fee breakdown</summary>{quoteQuery.data.items.map((item, index) => <div key={`${item.type}-${index}`}><span>{item.type}</span><strong>{formatNative(BigInt(item.amount))} {route?.source.network.chain.nativeCurrency.symbol}</strong></div>)}</details>
              </div>
            )}
          </section>

          <div className="bridge-action-row">
            <p><span className="secure-dot" />Real assets. Exact approvals. {delivery === "forwarded" ? "Circle handles the destination mint." : "You mint on the destination after attestation."}</p>
            {bridgeActionButton}
          </div>
          {tokenQuery.isError && <div className="registry-error">Circle’s live registry is unavailable. <button onClick={() => void tokenQuery.refetch()}>Try again</button></div>}
          {allowance && speed === "fast" && <p className="allowance-note">Live shared Fast allowance: ${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(allowance.allowance)} remaining.</p>}
        </main>
      )}

      {view === "routes" && <RouteBoard networks={networks} routes={routes} token={token} allowance={allowance} loading={tokenQuery.isPending || trustQuery.isPending} onSelect={selectRoute} />}
      {view === "activity" && <Activity records={transfer.records} onOpen={transfer.openRecord} onNew={() => { transfer.resetActive(); setView("bridge"); }} />}

      <footer className="site-footer"><span>eurc.zip · Zip your euros, skip the wrappers.</span><div><a href="https://developers.circle.com/cctp/expanded-assets" target="_blank" rel="noreferrer">CCTP docs <ArrowUpRight size={13} /></a><span>Non-custodial</span><span>Real EURC</span></div></footer>

      {reviewOpen && liveRoute && amountValue && quoteQuery.data && recipientValid && <ReviewDialog route={liveRoute} amount={amountValue} recipient={recipient as Address} speed={speed} delivery={delivery} quote={quoteQuery.data} onClose={() => setReviewOpen(false)} onConfirm={() => { setReviewOpen(false); void transfer.start({ route: liveRoute, amount: amountValue, recipient: recipient as Address, speed, delivery }); }} />}
      <TransferOverlay record={transfer.active} open={transfer.overlayOpen} onClose={transfer.closeActive} onReset={transfer.resetActive} onResume={transfer.openRecord} onMint={transfer.claimMint} />
    </div>
  );
}
