import {
  createPublicClient,
  formatUnits,
  http,
  parseUnits,
  zeroAddress,
  type Address,
  type Chain,
  type Hash,
  type Hex,
} from "viem";
import {
  arbitrum,
  arc,
  avalanche,
  base,
  mainnet,
  optimism,
  polygon,
  worldchain,
} from "viem/chains";

export const IRIS_BASE = "https://iris-api.circle.com";
export const EURC_TOKEN_ID =
  "0x6ca9e29fa53becc29becaf4a90b9ca7a995ad4d2234880da13ca38c657fb241c" as const;
export const CCTS_ADDRESS =
  "0x431871229103b780868f8C6BB820cd16ECf942BC" as const;
export const MESSAGE_TRANSMITTER_ADDRESS =
  "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64" as const;
export const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export type NetworkMeta = {
  domain: number;
  chain: Chain;
  shortName: string;
  rpc: string;
  colour: string;
  serviceDeployed: boolean;
};

export const NETWORKS: NetworkMeta[] = [
  {
    domain: 0,
    chain: mainnet,
    shortName: "Ethereum",
    rpc: "https://ethereum-rpc.publicnode.com",
    colour: "#747dff",
    serviceDeployed: true,
  },
  {
    domain: 1,
    chain: avalanche,
    shortName: "Avalanche",
    rpc: "https://api.avax.network/ext/bc/C/rpc",
    colour: "#ff5b5b",
    serviceDeployed: true,
  },
  {
    domain: 2,
    chain: optimism,
    shortName: "OP Mainnet",
    rpc: "https://mainnet.optimism.io",
    colour: "#ff4267",
    serviceDeployed: true,
  },
  {
    domain: 3,
    chain: arbitrum,
    shortName: "Arbitrum",
    rpc: "https://arb1.arbitrum.io/rpc",
    colour: "#4aa8ff",
    serviceDeployed: true,
  },
  {
    domain: 6,
    chain: base,
    shortName: "Base",
    rpc: "https://mainnet.base.org",
    colour: "#2d5bff",
    serviceDeployed: true,
  },
  {
    domain: 7,
    chain: polygon,
    shortName: "Polygon",
    rpc: "https://polygon-rpc.com",
    colour: "#9866ff",
    serviceDeployed: true,
  },
  {
    domain: 14,
    chain: worldchain,
    shortName: "World Chain",
    rpc: "https://worldchain-mainnet.g.alchemy.com/public",
    colour: "#202020",
    serviceDeployed: false,
  },
  {
    domain: 26,
    chain: arc,
    shortName: "Arc",
    rpc: "https://rpc.mainnet.arc.io",
    colour: "#ff8b4a",
    serviceDeployed: true,
  },
];

export const serviceAbi = [
  {
    name: "resolveTokenManager",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "bytes32" }],
    outputs: [{ name: "tokenManager", type: "address" }],
  },
  {
    name: "resolveTokenAddress",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "bytes32" }],
    outputs: [{ name: "token", type: "address" }],
  },
  {
    name: "isTrustedDomain",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "domain", type: "uint32" }],
    outputs: [{ name: "trusted", type: "bool" }],
  },
  {
    name: "crossChainTransfer",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "tokenId", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "destinationAddress", type: "bytes" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "minFinalityThreshold", type: "uint32" },
      {
        name: "claim",
        type: "tuple",
        components: [
          { name: "signedQuote", type: "bytes" },
          { name: "refundAddress", type: "address" },
        ],
      },
      { name: "autoExecuteHookData", type: "bool" },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "remaining", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "ok", type: "bool" }],
  },
] as const;

export const messageTransmitterAbi = [
  {
    name: "receiveMessage",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "message", type: "bytes" },
      { name: "attestation", type: "bytes" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
] as const;

export type TokenDeployment = {
  tokenId: Hex;
  domainId: number;
  tokenAddress: Address;
  tokenManagerAddress: Address;
  enabled: boolean;
};

export type EurcToken = {
  tokenId: Hex;
  name: string;
  symbol: string;
  decimals: number;
  fxSymbol: string | null;
  deployments: TokenDeployment[];
};

export type FastAllowance = {
  tokenId: Hex;
  tokenSymbol: string;
  allowance: number;
  lastUpdated: string;
};

export type TransferSpeed = "fast" | "standard";

export type QuoteItem = {
  type: string;
  amount: string;
};

export type FeeQuote = {
  signedQuote: Hex;
  issuedAt: number;
  expiry?: {
    mode: string;
    expiresAtBlock: string;
    blockEstimatedAt: number;
  };
  feeTotalAmount: string;
  feeToken: Address;
  items: QuoteItem[];
};

export type IrisMessage = {
  status: string;
  attestation?: Hex;
  message?: Hex;
  destinationTxHash?: Hash;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      const body = JSON.parse(text) as { message?: string; error?: string };
      message = body.message ?? body.error ?? text;
    } catch {
      // Keep the plain-text API error.
    }
    throw new Error(message || `Circle API returned ${response.status}`);
  }
  return JSON.parse(text) as T;
}

export async function fetchEurcToken(): Promise<EurcToken> {
  const body = await requestJson<{ data: EurcToken[] }>(
    `${IRIS_BASE}/v2/cctpx/tokens?tokenid=${EURC_TOKEN_ID}`,
  );
  const token = body.data[0];
  if (!token) throw new Error("Circle did not return the mainnet EURC deployment");
  return token;
}

export async function fetchFastAllowance(): Promise<FastAllowance | null> {
  const body = await requestJson<{ allowances: FastAllowance[] }>(
    `${IRIS_BASE}/v2/cctpx/allowances`,
  );
  return (
    body.allowances.find(
      (item) => item.tokenId.toLowerCase() === EURC_TOKEN_ID.toLowerCase(),
    ) ?? null
  );
}

export type TransferDelivery = "forwarded" | "manual";

export function fetchFeeQuote({
  amount,
  sourceDomain,
  destinationDomain,
  recipient,
  speed,
  delivery = "forwarded",
}: {
  amount: bigint;
  sourceDomain: number;
  destinationDomain: number;
  recipient: Address;
  speed: TransferSpeed;
  delivery?: TransferDelivery;
}): Promise<FeeQuote> {
  const requests: unknown[] = [];
  if (speed === "fast") requests.push({ type: "PRE_FINALITY" });
  if (delivery === "forwarded") {
    requests.push({
      type: "FORWARD",
      params: { msgType: "TransferMessage", destinationAddress: recipient },
    });
  }
  return requestJson<FeeQuote>(
    `${IRIS_BASE}/v2/quote/cctpx/${EURC_TOKEN_ID}/${sourceDomain}/${destinationDomain}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amount.toString(),
        feeToken: zeroAddress,
        requests,
      }),
    },
  );
}

export async function fetchIrisMessage(
  sourceDomain: number,
  transactionHash: Hash,
): Promise<IrisMessage | null> {
  const body = await requestJson<{ messages?: IrisMessage[] }>(
    `${IRIS_BASE}/v2/messages/${sourceDomain}?transactionHash=${transactionHash}`,
  );
  return body.messages?.[0] ?? null;
}

const clients = new Map<number, ReturnType<typeof createPublicClient>>();

export function getPublicClient(domain: number) {
  const cached = clients.get(domain);
  if (cached) return cached;
  const network = getNetwork(domain);
  const client = createPublicClient({
    chain: network.chain,
    transport: http(network.rpc, { timeout: 15_000 }),
  });
  clients.set(domain, client);
  return client;
}

export function getNetwork(domain: number): NetworkMeta {
  const network = NETWORKS.find((item) => item.domain === domain);
  if (!network) throw new Error(`Unknown CCTP domain ${domain}`);
  return network;
}

export function parseEurc(value: string): bigint | null {
  if (!value || !/^\d*(\.\d{0,6})?$/.test(value) || value === ".") return null;
  try {
    const parsed = parseUnits(value, 6);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

export function formatEurc(value: bigint, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(Number(formatUnits(value, 6)));
}

export function formatNative(value: bigint): string {
  const formatted = formatUnits(value, 18);
  const numeric = Number(formatted);
  if (numeric > 0 && numeric < 0.000001) return "<0.000001";
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 6,
  }).format(numeric);
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function explorerTx(network: NetworkMeta, hash: Hash): string {
  return `${network.chain.blockExplorers?.default.url}/tx/${hash}`;
}

export function explorerAddress(network: NetworkMeta, address: Address): string {
  return `${network.chain.blockExplorers?.default.url}/address/${address}`;
}

export const nativeFeeAddress = zeroAddress;
