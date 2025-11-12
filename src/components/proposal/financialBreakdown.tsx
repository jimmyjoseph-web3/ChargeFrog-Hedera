"use client";

import { useState } from "react";

interface Station {
  hbarPriceAtCreation: number;
}

export default function FinancialBreakdown({ station }: { station: Station }) {
  const [showInHbar, setShowInHbar] = useState(false);

  // --- Helper function to format currency or HBAR ---
  const formatValue = (usd: number, withYear?: boolean) => {
    if (showInHbar) {
      const hbar = usd / (station?.hbarPriceAtCreation || 1);
      return `${Math.round(hbar).toLocaleString()} HBAR${withYear ? "/year" : ""}`;
    }
    return `$${usd.toLocaleString()}${withYear ? "/year" : ""}`;
  };

  return (
    <div className="mt-8">
      {/* --- Toggle Row --- */}
      <div className="flex items-center justify-end mb-4">
        <span
          className={`text-sm mr-2 transition-colors duration-300 ${
            showInHbar
              ? "font-semibold text-[#00dd00]"
              : "font-medium text-gray-500"
          }`}
        >
          Show in HBAR
        </span>
        <button
          onClick={() => setShowInHbar(!showInHbar)}
          className={`relative w-12 h-6 rounded-full border transition-colors duration-300 ${
            showInHbar
              ? "bg-[#00dd00] border-[#00dd00]"
              : "bg-gray-100 border-gray-300"
          }`}
        >
          <div
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform duration-300 ${
              showInHbar ? "translate-x-6 bg-white" : "translate-x-0 bg-gray-300"
            }`}
          ></div>
        </button>
      </div>

      {/* --- Financial Breakdown --- */}
      <div>
        <h2 className="text-xl font-medium text-gray-900 mb-4">
          Financial Breakdown
        </h2>

        {/* CAPEX / OPEX */}
        <div className="text-sm text-gray-700 space-y-3 mb-6">
          <p>
            <span className="font-medium">Estimated Setup Cost (CAPEX):</span>{" "}
            <span className="text-gray-900 font-semibold">
              {formatValue(47686)}
            </span>
          </p>
          <p>
            <span className="font-medium">
              Estimated Operating Cost (OPEX-Annual):
            </span>{" "}
            <span className="text-gray-900 font-semibold">
              {formatValue(53380, true)}
            </span>
          </p>
        </div>

        {/* --- Projected Revenue --- */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Projected Revenue
          </h3>

          <div className="grid grid-cols-[180px_1fr] gap-y-4 text-sm">
            {/* Charging Fee */}
            <div className="text-gray-600">Charging Fee</div>
            <div className="text-gray-900 font-medium">
              {showInHbar ? "0.29 HBAR / kWh" : "$0.29 / kWh"}
            </div>

            {/* Utilization */}
            <div className="text-gray-600">Utilization</div>
            <div className="text-gray-900 font-medium space-y-0.5">
              <p>~ 25,000 kWh/month</p>
              <p>~ {formatValue(7250)} / month</p>
              <p>~ {formatValue(87000)} / year</p>
            </div>

            {/* Net Profit (Before Tax) */}
            <div className="text-gray-600">Net Profit (Before Tax)</div>
            <div className="text-black font-bold flex items-center gap-1">
              ~ {formatValue(33620, true)}
              <span className="text-green-500">★</span>
            </div>

            {/* Payback Period */}
            <div className="text-gray-600">Payback Period</div>
            <div className="text-gray-900 font-medium">
              ~ 1.42 years (on {formatValue(47686)} CAPEX)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
