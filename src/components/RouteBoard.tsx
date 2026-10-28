import { ArrowRight, ArrowUpRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { NetworkDeployment, RouteInfo } from "../hooks/useRoutes";
import {
  explorerAddress,
  shortAddress,
  type EurcToken,
  type FastAllowance,
} from "../lib/cctp";

const statusLabels: Record<RouteInfo["status"], string> = {
  live: "Live",
  checking: "Checking",
  disabled: "Disabled by Circle",
  "not-deployed": "Not deployed",
  untrusted: "Not trusted",
  unknown: "RPC unavailable",
};

export function RouteBoard({
  networks,
  routes,
  token,
  allowance,
  loading,
  onSelect,
}: {
  networks: NetworkDeployment[];
  routes: RouteInfo[];
  token?: EurcToken;
  allowance?: FastAllowance | null;
  loading: boolean;
  onSelect: (route: RouteInfo) => void;
}) {
  const [showLiveOnly, setShowLiveOnly] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      routes.filter((route) => {
        if (showLiveOnly && route.status !== "live") return false;
        const query = search.toLowerCase();
        return `${route.source.network.shortName} ${route.destination.network.shortName}`
          .toLowerCase()
          .includes(query);
      }),
    [routes, search, showLiveOnly],
  );
  const liveCount = routes.filter((route) => route.status === "live").length;

  return (
    <main className="page-shell route-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">LIVE CIRCLE REGISTRY</p>
          <h1>Every EURC route<span className="violet-full-stop">.</span></h1>
          <p>Live deployments from Circle, with bilateral trust checks on each source contract.</p>
        </div>
        <div className="route-count"><strong>{liveCount}</strong><span>live directions</span></div>
      </div>

      <section className="registry-summary">
        <div><span>Token</span><strong>{token?.symbol ?? "EURC"}</strong></div>
        <div><span>Deployments</span><strong>{networks.filter((network) => network.status === "enabled").length} enabled</strong></div>
        <div><span>Fast allowance</span><strong>{allowance ? `$${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(allowance.allowance)}` : "Loading"}</strong></div>
        <div><span>Environment</span><strong>Live chains</strong></div>
      </section>

      <section className="network-grid" aria-label="EURC deployments">
        {networks.map(({ network, deployment, status }) => (
          <article className={`network-card status-${status}`} key={network.domain}>
            <div className="network-card-title"><span className="network-dot" style={{ background: network.colour }} /><h3>{network.shortName}</h3></div>
            <span className={`status-badge status-${status}`}>{status === "enabled" ? "Enabled" : statusLabels[status]}</span>
            <dl>
              <div><dt>Domain</dt><dd>{network.domain}</dd></div>
              <div><dt>Chain ID</dt><dd>{network.chain.id}</dd></div>
              <div><dt>Fee token</dt><dd>{network.chain.nativeCurrency.symbol}</dd></div>
            </dl>
            {deployment?.tokenAddress ? (
              <a href={explorerAddress(network, deployment.tokenAddress)} target="_blank" rel="noreferrer" title={deployment.tokenAddress}>
                EURC {shortAddress(deployment.tokenAddress)} <ArrowUpRight size={13} />
              </a>
            ) : <span className="no-contract">No EURC contract listed</span>}
          </article>
        ))}
      </section>

      <section className="route-directory">
        <div className="directory-toolbar">
          <div><p className="eyebrow">DIRECTIONAL MATRIX</p><h2>{filtered.length} routes</h2></div>
          <div className="directory-controls">
            <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a network" aria-label="Find a network" /></label>
            <button className={`filter-button ${showLiveOnly ? "active" : ""}`} onClick={() => setShowLiveOnly((value) => !value)}>Live only</button>
          </div>
        </div>
        {loading ? (
          <div className="route-loading"><img src="/eurc.png" alt="" />Checking Circle and every source contract…</div>
        ) : (
          <div className="route-table-wrap">
            <table className="route-table">
              <thead><tr><th>Source</th><th>Destination</th><th>Domains</th><th>Status</th><th><span className="sr-only">Use route</span></th></tr></thead>
              <tbody>
                {filtered.map((route) => (
                  <tr key={route.id}>
                    <td><span className="network-dot" style={{ background: route.source.network.colour }} />{route.source.network.shortName}</td>
                    <td><span className="network-dot" style={{ background: route.destination.network.colour }} />{route.destination.network.shortName}</td>
                    <td className="mono">{route.source.network.domain} → {route.destination.network.domain}</td>
                    <td><span className={`status-badge route-status-${route.status}`}>{statusLabels[route.status]}</span></td>
                    <td>{route.status === "live" && <button className="use-route" onClick={() => onSelect(route)}>Use <ArrowRight size={15} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="empty-state">No routes match that search.</p>}
          </div>
        )}
      </section>
    </main>
  );
}
