import { ArrowRight, ArrowUpRight } from "lucide-react";
import {
  explorerTx,
  formatEurc,
  shortAddress,
} from "../lib/cctp";
import { transferNetwork, type TransferRecord } from "../hooks/useBridgeTransfer";

export function Activity({
  records,
  onOpen,
  onNew,
}: {
  records: TransferRecord[];
  onOpen: (record: TransferRecord) => void;
  onNew: () => void;
}) {
  return (
    <main className="page-shell activity-page">
      <div className="page-heading">
        <div><p className="eyebrow">THIS BROWSER</p><h1>Your zips<span className="violet-full-stop">.</span></h1><p>Locally saved transfer state. Incomplete forwarded transfers resume without burning again.</p></div>
        <button className="primary-button" onClick={onNew}>New transfer <ArrowRight size={17} /></button>
      </div>
      {records.length === 0 ? (
        <div className="empty-activity"><img src="/eurc.png" alt="" /><h2>No zips yet.</h2><p>Your transfers will appear here.</p><button className="secondary-button" onClick={onNew}>Move some EURC</button></div>
      ) : (
        <div className="activity-list">
          {records.map((record) => {
            const source = transferNetwork(record, "source");
            const destination = transferNetwork(record, "destination");
            return (
              <article className="activity-card" key={record.id}>
                <div className="activity-amount"><img src="/eurc.png" alt="" /><strong>{formatEurc(BigInt(record.amount), 6)}</strong><span>EURC</span></div>
                <div className="activity-route"><strong>{source.shortName} → {destination.shortName}</strong><span>{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(record.createdAt)} · {record.speed}</span></div>
                <div className="activity-recipient"><span>Recipient</span><strong title={record.recipient}>{shortAddress(record.recipient)}</strong></div>
                <span className={`status-badge transfer-status-${record.status}`}>{record.status}</span>
                <div className="activity-actions">
                  {record.sourceTx && <a className="icon-button" aria-label="View source transaction" href={explorerTx(source, record.sourceTx)} target="_blank" rel="noreferrer"><ArrowUpRight size={18} /></a>}
                  <button className="secondary-button" onClick={() => onOpen(record)}>Details</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
