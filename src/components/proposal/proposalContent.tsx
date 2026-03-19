import Image from "next/image";
import FinancialBreakdown from "./financialBreakdown";
import Timeline from "./timeline";
import TokenizationInfo from "./tokenizationInfo";
import InvestmentStats from "./investmentStats";
import InvestButton from "./investButton";
import {
  StationData,
  formatCurrency,
  formatDateDisplay,
  formatNumber,
  formatPercent,
  getAvailablePortsCount,
  getPortGroups,
  truncateMiddle,
} from "./proposalFormatters";

function InfoCard({
  title,
  value,
  helper,
  valueClassName,
}: {
  title: string;
  value: string;
  helper?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
        {title}
      </p>
      <p
        className={`mt-2 text-sm font-medium text-gray-950 ${valueClassName ?? ""}`}
      >
        {value}
      </p>
      {helper ? (
        <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{helper}</p>
      ) : null}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-5 md:p-6">
      <h2 className="text-lg font-medium text-gray-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MetadataLink({
  label,
  href,
  value,
}: {
  label: string;
  href?: string;
  value: string;
}) {
  if (!value || value === "—") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
          {label}
        </span>
        <span className="text-sm text-gray-400">—</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
        {label}
      </span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-sm font-medium text-gray-950 underline underline-offset-4 transition hover:text-blue-600"
        >
          {value}
        </a>
      ) : (
        <span className="break-all text-sm font-medium text-gray-950">
          {value}
        </span>
      )}
    </div>
  );
}

export default function ProposalContent({ station }: { station: StationData }) {
  const ports = station.portsInfo || [];
  const portGroups = getPortGroups(ports);
  const availablePorts = getAvailablePortsCount(ports);

  const creationTxUrl = station.creationTxHash
    ? `https://hashscan.io/testnet/transaction/${station.creationTxHash}`
    : undefined;

  const locationHashUrl = station.locationHash
    ? `https://hashscan.io/testnet/transaction/${station.locationHash}`
    : undefined;

  return (
    <div className="pt-8">
      <div className="rounded-[28px] border border-gray-200 bg-white p-6 md:p-8">
        <p className="text-sm font-normal text-gray-500">
          ChargeFrog Station Proposal #{station.proposalId}
        </p>

        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-medium tracking-tight text-gray-950">
              {station.stationName}
            </h1>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700">
                {station.locationCategory}
              </span>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700">
                {formatNumber(station.numberOfPort)} ports
              </span>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700">
                Grid {formatNumber(station.gridCapacityAvailableKva)} kVA
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center gap-2">
            <Image
              src="/station/location.png"
              alt="Location"
              width={18}
              height={18}
            />
            <a
              href={station.googleMapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-950 underline underline-offset-4 transition hover:text-blue-600"
            >
              View on Google Map
            </a>
          </div>

          <div className="mt-4 space-y-4">
            <MetadataLink
              label="Creation Tx"
              href={creationTxUrl}
              value={station.creationTxHash || "—"}
            />
            <MetadataLink
              label="Location Hash"
              href={locationHashUrl}
              value={station.locationHash || "—"}
            />
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-950">
            Why this location?
          </h2>
          <p className="mt-3 text-sm leading-7 text-gray-700">
            {station.whyThisLocation || "No description provided."}
          </p>
        </div>
      </div>

      <Section title="Proposal highlights">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoCard
            title="Lease / Month"
            value={formatCurrency(station.leaseCost?.usdMonthly)}
            helper={`${formatNumber(station.leaseCost?.termYears)} year term`}
          />
          <InfoCard
            title="Permit Cost"
            value={formatCurrency(station.permitCostUsd)}
            helper={station.zoningPermitStatus || "Pending status"}
          />
          <InfoCard
            title="Gross Revenue"
            value={formatCurrency(
              station.revenueModel?.grossMonthlyRevenue?.usd,
            )}
            helper={`${formatNumber(station.revenueModel?.monthlyEnergySoldKwh)} kWh / month`}
          />
          <InfoCard
            title="Utility Provider"
            value={station.localUtilityProvider || "—"}
            helper={`Settlement: ${station.revenueModel?.treasurySettlementCurrency || "—"}`}
          />
        </div>
      </Section>

      <Section title="Station specifications">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 p-5 text-center">
            <Image
              src="/proposal/station.png"
              alt="Station"
              width={40}
              height={40}
              className="mb-2"
            />
            <span className="mt-1 text-sm font-medium text-gray-900">
              {formatNumber(station.numberOfPort)} ports total
            </span>
            <span className="mt-1 text-xs text-gray-500">
              {formatNumber(availablePorts)} currently available
            </span>
          </div>

          {portGroups.slice(0, 2).map((group) => (
            <div
              key={group.key}
              className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 p-5 text-center"
            >
              <Image
                src="/proposal/port.png"
                alt={group.acdc}
                width={40}
                height={40}
                className="mb-2"
              />
              <span className="mt-1 text-sm font-medium text-gray-900">
                {group.count} × {group.type} {group.acdc}
              </span>
              <span className="mt-1 text-xs text-gray-500">
                Up to {group.kW} kW
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Revenue model">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <InfoCard
            title="Pricing Model"
            value={station.revenueModel?.pricingModel || "—"}
            helper={`USD ${station.revenueModel?.pricePerKwhUsd ?? "—"}/kWh • HBAR ${station.revenueModel?.pricePerKwhHbar ?? "—"}/kWh`}
          />
          <InfoCard
            title="Expected Throughput"
            value={`${formatNumber(station.revenueModel?.expectedSessionsPerDay)} sessions / day`}
            helper={`${formatNumber(station.revenueModel?.averageSessionLengthKwh)} kWh average session`}
          />
        </div>
      </Section>

      <Section title="Site readiness and compliance">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <InfoCard
            title="Zoning Permit"
            value={station.zoningPermitStatus || "—"}
            helper={`Execution timelock: ${formatNumber(station.governanceCompliance?.executionDelayTimelockHours)} hours`}
          />
          <InfoCard
            title="Emergency Shutdown"
            value={
              station.governanceCompliance?.emergencyShutdownFlag
                ? "Enabled"
                : "Disabled"
            }
            helper={
              station.governanceCompliance?.disputeResolutionMechanism ||
              "No dispute flow provided"
            }
          />
          <InfoCard
            title="Proposal Expiry"
            value={formatDateDisplay(
              station.governanceCompliance?.proposalExpiryDate,
            )}
            helper={`Operator: ${station.governanceCompliance?.operatorAddress || "—"}`}
          />
          <InfoCard
            title="Treasury Address"
            value={
              station.governanceCompliance?.treasuryAddress || "Not assigned"
            }
            helper={`Creation tx: ${truncateMiddle(station.creationTxHash)}`}
          />
        </div>
      </Section>

      <Section title="Risk sensitivity">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <InfoCard
            title="Break-even utilization"
            value={`${formatPercent(station.riskSensitivityMetrics?.breakEvenUtilizationPercent)} • ${formatNumber(station.riskSensitivityMetrics?.breakEvenUtilizationKwhPerMonth)} kWh/month`}
          />
          <InfoCard
            title="Worst vs best case"
            value={`${formatPercent(station.riskSensitivityMetrics?.worstCaseUtilizationPercent)} ↔ ${formatPercent(station.riskSensitivityMetrics?.bestCaseUtilizationPercent)}`}
            helper={`${formatNumber(station.riskSensitivityMetrics?.worstCaseUtilizationKwhPerMonth)} to ${formatNumber(station.riskSensitivityMetrics?.bestCaseUtilizationKwhPerMonth)} kWh/month`}
          />
          <InfoCard
            title="Revenue variance"
            value={formatPercent(
              station.riskSensitivityMetrics?.revenueVariancePercent,
            )}
            helper={
              station.riskSensitivityMetrics?.electricityPriceSensitivity || "—"
            }
          />
          <InfoCard
            title="Risk profile"
            value={`Regulatory ${station.riskSensitivityMetrics?.regulatoryRiskLevel || "—"}`}
            helper={`Technology ${station.riskSensitivityMetrics?.technologyObsolescenceRisk || "—"}`}
          />
        </div>
      </Section>

      <Section title="Geospatial integrity">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <InfoCard
            title="Coordinates"
            value={station.locationCoordinates || "—"}
          />
          <InfoCard title="Geohash" value={station.geohash || "—"} />
          <InfoCard
            title="Location Hash"
            value={truncateMiddle(station.locationHash, 12, 10)}
            valueClassName="break-all"
          />
        </div>
      </Section>

      <div className="pb-35">
        <FinancialBreakdown station={station} />
        <Timeline station={station} />
        <TokenizationInfo station={station} />
        <InvestmentStats station={station} />
        <InvestButton station={station} />
      </div>
    </div>
  );
}
