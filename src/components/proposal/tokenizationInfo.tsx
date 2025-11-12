"use client";

import { Info } from "lucide-react";

interface Station {
  hbarPriceAtCreation: number;
}

export default function TokenizationInfo({ station }: { station: Station }) {
  const investmentTargetUSD = 96568;
  const hbarValue = Math.round(investmentTargetUSD / (station.hbarPriceAtCreation || 1));

  return (
    <div className="mt-10">
      {/* Title */}
      <h2 className="text-xl font-medium text-gray-900 mb-6">
        Tokenization and Community Ownership
      </h2>

      {/* Info Grid */}
      <div className="grid grid-cols-[200px_1fr] gap-y-4 text-sm">
        {/* Investment Target */}
        <div className="text-gray-600 flex items-baseline">
          Investment Target <Info size={14} className="ml-1 text-gray-400" />
        </div>
        <div className="text-gray-900 font-medium flex flex-col">
          <span>${investmentTargetUSD.toLocaleString()}</span>
          <span className="text-black font-semibold flex items-center gap-1">
            HBAR {hbarValue.toLocaleString()} <span className="text-lg text-[#00dd00]">★</span>
          </span>
        </div>

        {/* Token Model */}
        <div className="text-gray-600">Token Model</div>
        <div className="text-gray-900 font-medium">1 HBAR per token</div>

        {/* Total Issued Token */}
        <div className="text-gray-600">Total Issued Token</div>
        <div className="text-gray-900 font-medium">2,484,651</div>

        {/* Minimum Fraction */}
        <div className="text-gray-600">Minimum Fraction</div>
        <div className="text-gray-900 font-medium">1 token</div>

        {/* Ownership Model */}
        <div className="text-gray-600">Ownership Model</div>
        <div className="text-gray-900 font-medium">Non-Transferable</div>

        {/* Revenue Distribution */}
        <div className="text-gray-600">Revenue Distribution</div>
        <div className="text-gray-900 font-medium">Monthly Redemption</div>
      </div>
    </div>
  );
}
