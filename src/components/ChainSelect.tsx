import { ChevronDown } from "lucide-react";
import type { NetworkDeployment } from "../hooks/useRoutes";

export function ChainSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: NetworkDeployment[];
  onChange: (domain: number) => void;
}) {
  const selected = options.find((option) => option.network.domain === value) ?? options[0];
  return (
    <label className="chain-select" style={{ "--chain-colour": selected?.network.colour } as React.CSSProperties}>
      <span className="network-dot" />
      <span className="chain-select-name">{selected?.network.shortName ?? "Network"}</span>
      <ChevronDown size={22} strokeWidth={2.4} aria-hidden="true" />
      <select
        aria-label={label}
        value={selected?.network.domain}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {options.map((option) => (
          <option key={option.network.domain} value={option.network.domain}>
            {option.network.shortName}
          </option>
        ))}
      </select>
    </label>
  );
}
