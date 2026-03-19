"use client";

import { useState } from "react";
import { StationData, formatCurrency, formatNumber } from "./proposalFormatters";

export default function FinancialBreakdown({ station }: { station: StationData }) {
  const [showInHbar, setShowInHbar] = useState(false);

  const hbarPrice = station?.hbarPriceAtCreation || 1;
  const permitCost = station.permitCostUsd || 0;
  const annualLease = (station.leaseCost?.usdMonthly || 0) * 12;
  const estimatedCapex = permitCost;
  const estimatedOpexAnnual = annualLease;
  const grossMonthlyRevenueUsd = station.revenueModel?.grossMonthlyRevenue?.usd || 0;
  const grossYearlyRevenueUsd = grossMonthlyRevenueUsd * 12;
  const netProfitAnnualUsd = grossYearlyRevenueUsd - estimatedOpexAnnual;
  const paybackYears = estimatedCapex > 0 && netProfitAnnualUsd > 0 ? estimatedCapex / netProfitAnnualUsd : null;

  const formatValue = (usd: number, suffix = "") => {
    if (showInHbar) {
      const hbar = usd / hbarPrice;
      return `${formatNumber(hbar)} HBAR${suffix}`;
    }
    return `${formatCurrency(usd)}${suffix}`;
  };

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-end">
        <span className={`mr-2 text-sm transition-colors duration-300 ${showInHbar ? "font-semibold text-[#00dd00]" : "font-medium text-gray-500"}`}>
          Show in HBAR
        </span>
        <button
          onClick={() => setShowInHbar(!showInHbar)}
          className={`relative h-6 w-12 rounded-full border transition-colors duration-300 ${showInHbar ? "border-[#00dd00] bg-[#00dd00]" : "border-gray-300 bg-gray-100"}`}
        >
          <div className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full transition-transform duration-300 ${showInHbar ? "translate-x-6 bg-white" : "translate-x-0 bg-gray-300"}`} />
        </button>
      </div>

      <div>
        <h2 className="mb-4 text-xl font-medium text-gray-900">Financial Breakdown</h2>

        <div className="mb-6 space-y-3 text-sm text-gray-700">
          <p>
            <span className="font-medium">Estimated Setup Cost (Permits / CAPEX):</span>{" "}
            <span className="font-semibold text-gray-900">{formatValue(estimatedCapex)}</span>
          </p>
          <p>
            <span className="font-medium">Estimated Operating Cost (Lease / OPEX-Annual):</span>{" "}
            <span className="font-semibold text-gray-900">{formatValue(estimatedOpexAnnual, "/year")}</span>
          </p>
        </div>

        <div>
          <h3 className="mb-4 text-lg font-medium text-gray-900">Projected Revenue</h3>

          <div className="grid grid-cols-[180px_1fr] gap-y-4 text-sm">
            <div className="text-gray-600">Charging Fee</div>
            <div className="font-medium text-gray-900">
              {showInHbar
                ? `${formatNumber(station.revenueModel?.pricePerKwhHbar, 4)} HBAR / kWh`
                : `${formatCurrency(station.revenueModel?.pricePerKwhUsd)} / kWh`}
            </div>

            <div className="text-gray-600">Utilization</div>
            <div className="space-y-0.5 font-medium text-gray-900">
              <p>~ {formatNumber(station.revenueModel?.monthlyEnergySoldKwh)} kWh / month</p>
              <p>~ {formatValue(grossMonthlyRevenueUsd)} / month</p>
              <p>~ {formatValue(grossYearlyRevenueUsd)} / year</p>
            </div>

            <div className="text-gray-600">Net Profit (Before Tax)</div>
            <div className="flex items-center gap-1 font-bold text-black">
              ~ {formatValue(netProfitAnnualUsd, "/year")}
              <span className="text-green-500">★</span>
            </div>

            <div className="text-gray-600">Payback Period</div>
            <div className="font-medium text-gray-900">
              {paybackYears ? `~ ${paybackYears.toFixed(2)} years` : "Not yet profitable under current assumptions"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
