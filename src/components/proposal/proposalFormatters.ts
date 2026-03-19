export type PortInfo = {
  acdc?: string;
  bayNumber?: string;
  creditPerKWh?: number;
  kW?: string | number;
  status?: string;
  type?: string;
};

export type StationData = {
  proposalId: string;
  stationId?: string;
  stationName: string;
  openInvestmentDate?: string;
  googleMapLink?: string;
  locationCategory?: string;
  locationCoordinates?: string;
  numberOfPort?: string | number;
  outletAvailable?: string | number;
  portsInfo?: PortInfo[];
  investorNumber?: number;
  tokenIssuedOut?: number;
  largestInvestment?: number;
  totalShares?: string | number;
  numberOfSharesIssued?: number;
  whyThisLocation?: string;
  isInvestmentEnded?: boolean;
  timeline?: {
    startDate?: string;
    goLiveDate?: string;
  };
  leaseCost?: {
    usdMonthly?: number;
    hbarMonthly?: number;
    termYears?: number;
  };
  gridCapacityAvailableKva?: number;
  localUtilityProvider?: string;
  zoningPermitStatus?: string;
  permitCostUsd?: number;
  revenueModel?: {
    pricingModel?: string;
    pricePerKwhUsd?: number;
    pricePerKwhHbar?: number;
    expectedSessionsPerDay?: number;
    averageSessionLengthKwh?: number;
    monthlyEnergySoldKwh?: number;
    grossMonthlyRevenue?: {
      usd?: number;
      hbarEquivalent?: number;
    };
    treasurySettlementCurrency?: string;
  };
  riskSensitivityMetrics?: {
    breakEvenUtilizationPercent?: number;
    breakEvenUtilizationKwhPerMonth?: number;
    worstCaseUtilizationPercent?: number;
    worstCaseUtilizationKwhPerMonth?: number;
    bestCaseUtilizationPercent?: number;
    bestCaseUtilizationKwhPerMonth?: number;
    electricityPriceSensitivity?: string;
    revenueVariancePercent?: number;
    regulatoryRiskLevel?: string;
    technologyObsolescenceRisk?: string;
  };
  governanceCompliance?: {
    proposalExpiryDate?: string;
    executionDelayTimelockHours?: number;
    operatorAddress?: string;
    treasuryAddress?: string | null;
    emergencyShutdownFlag?: boolean;
    disputeResolutionMechanism?: string;
  };
  geohash?: string;
  locationHash?: string;
  hbarPriceAtCreation?: number;
  mntPriceAtCreation?: number;
  iotaPriceAtCreation?: number;
  creationTxHash?: string;
};

export function formatCurrency(value?: number | null, currency = "USD") {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value < 1 ? 4 : 0,
  }).format(value);
}

export function formatNumber(value?: number | string | null, maximumFractionDigits = 0) {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (typeof numeric !== "number" || Number.isNaN(numeric)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(numeric);
}

export function formatPercent(value?: number | null, maximumFractionDigits = 2) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${value.toFixed(maximumFractionDigits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")}%`;
}

export function formatDateDisplay(value?: string | null) {
  if (!value) return "—";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split("/").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function parseDdMmYyyy(value?: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  return new Date(year, month - 1, day);
}

export function getPortGroups(ports: PortInfo[] = []) {
  const grouped = new Map<string, { key: string; count: number; acdc: string; type: string; kW: string | number }>();

  for (const port of ports) {
    const acdc = String(port.acdc || "Unknown").toUpperCase();
    const type = port.type || "Unknown";
    const kW = port.kW || "—";
    const key = `${acdc}-${type}-${kW}`;

    const current = grouped.get(key);
    if (current) {
      current.count += 1;
    } else {
      grouped.set(key, { key, count: 1, acdc, type, kW });
    }
  }

  return Array.from(grouped.values());
}

export function getAvailablePortsCount(ports: PortInfo[] = []) {
  return ports.filter((port) => String(port.status || "").toLowerCase() === "available").length;
}

export function getFundingProgressPercent(station: StationData) {
  const issued = typeof station.numberOfSharesIssued === "number" ? station.numberOfSharesIssued : Number(station.numberOfSharesIssued || 0);
  const total = typeof station.totalShares === "number" ? station.totalShares : Number(station.totalShares || 0);
  if (!total) return 0;
  return (issued / total) * 100;
}

export function getCountdownState(openInvestmentDate?: string, isInvestmentEnded?: boolean) {
  const openDate = parseDdMmYyyy(openInvestmentDate);
  if (!openDate) {
    return { label: isInvestmentEnded ? "Completed" : "Unavailable", isActive: false };
  }
  if (isInvestmentEnded) {
    return { label: "Completed", isActive: false };
  }
  return {
    label: openDate.getTime() <= Date.now() ? "Active" : "Upcoming",
    isActive: openDate.getTime() <= Date.now(),
  };
}

export function truncateMiddle(value?: string | null, lead = 8, tail = 6) {
  if (!value) return "—";
  if (value.length <= lead + tail + 3) return value;
  return `${value.slice(0, lead)}...${value.slice(-tail)}`;
}
