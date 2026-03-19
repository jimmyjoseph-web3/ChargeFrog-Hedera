"use client";

import { Info } from "lucide-react";
import { StationData, formatCurrency, formatNumber } from "./proposalFormatters";

export default function TokenizationInfo({ station }: { station: StationData }) {
  const investmentTargetUSD = station.permitCostUsd || 0;
  const hbarValue = station.hbarPriceAtCreation ? investmentTargetUSD / station.hbarPriceAtCreation : 0;
  const totalIssuedToken = station.totalShares || station.numberOfSharesIssued || 0;

  return (
    <div className="mt-10">
      <h2 className="mb-6 text-xl font-medium text-gray-900">Tokenization and Community Ownership</h2>

      <div className="grid grid-cols-[200px_1fr] gap-y-4 text-sm">
        <div className="flex items-baseline text-gray-600">
          Investment Target <Info size={14} className="ml-1 text-gray-400" />
        </div>
        <div className="flex flex-col font-medium text-gray-900">
          <span>{formatCurrency(investmentTargetUSD)}</span>
          <span className="flex items-center gap-1 font-semibold text-black">
            HBAR {formatNumber(hbarValue)} <span className="text-lg text-[#00dd00]">★</span>
          </span>
        </div>

        <div className="text-gray-600">Token Model</div>
        <div className="font-medium text-gray-900">Revenue participation share</div>

        <div className="text-gray-600">Total Issued Token</div>
        <div className="font-medium text-gray-900">{formatNumber(totalIssuedToken)}</div>

        <div className="text-gray-600">Minimum Fraction</div>
        <div className="font-medium text-gray-900">1 token</div>

        <div className="text-gray-600">Ownership Model</div>
        <div className="font-medium text-gray-900">Fractional infrastructure exposure</div>

        <div className="text-gray-600">Revenue Distribution</div>
        <div className="font-medium text-gray-900">Treasury settlement: {station.revenueModel?.treasurySettlementCurrency || "Mixed"}</div>
      </div>
    </div>
  );
}
