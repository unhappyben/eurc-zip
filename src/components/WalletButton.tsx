import { LogOut, Wallet, X } from "lucide-react";
import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shortAddress } from "../lib/cctp";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="wallet-button" onClick={() => setOpen(true)}>
        {isConnected ? <span className="wallet-live-dot" /> : <Wallet size={17} />}
        {isConnected && address ? shortAddress(address) : "Connect wallet"}
      </button>
      {open && (
        <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
          <section
            className="wallet-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="icon-button modal-close" aria-label="Close" onClick={() => setOpen(false)}>
              <X size={20} />
            </button>
            <p className="eyebrow">YOUR WALLET</p>
            <h2 id="wallet-title">{isConnected ? "Connected." : "Find your EURC."}</h2>
            {isConnected && address ? (
              <>
                <p className="muted">We check every enabled deployment for your EURC balance.</p>
                <div className="connected-address">{address}</div>
                <button
                  className="secondary-button full-width"
                  onClick={() => {
                    disconnect();
                    setOpen(false);
                  }}
                >
                  <LogOut size={17} /> Disconnect
                </button>
              </>
            ) : (
              <>
                <p className="muted">Use your existing browser wallet. No account, private key, or API key needed.</p>
                <div className="connector-list">
                  {connectors.map((connector) => (
                    <button
                      className="primary-button full-width"
                      key={connector.uid}
                      disabled={isPending}
                      onClick={() => connect({ connector }, { onSuccess: () => setOpen(false) })}
                    >
                      <Wallet size={18} />
                      {isPending ? "Waiting for wallet…" : `Connect ${connector.name}`}
                    </button>
                  ))}
                </div>
                {error && <p className="error-text">{error.message}</p>}
                <p className="fine-print">Works with injected wallets such as Rabby and MetaMask. EIP-5792 batching is used when supported.</p>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
