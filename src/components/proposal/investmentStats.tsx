"use client";

import Image from "next/image";

interface Station {
  investorNumber: number;
  tokenIssuedOut: number;
  largestInvestment: number;
}

export default function InvestmentStats({ station }: { station: Station }) {
  // --- Helper function to format large numbers ---
  const formatNumber = (num: number): string => {
    if (num >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return num.toString();
  };

  return (
    <div className="mt-10">
      <h2 className="text-xl font-medium text-gray-900 mb-4">
        Investment Stats
      </h2>

      <div className="flex justify-between items-stretch gap-2">
        {/* Investor(s) */}
        <div className="flex flex-col items-center justify-center border border-gray-200 bg-white rounded-lg shadow-sm flex-1 py-6">
          <Image
            src="/proposal/investor.png"
            alt="Investor"
            width={39}
            height={39}
            className="mb-6"
          />
          <p className="text-gray-500 text-sm font-medium mb-2">Investor(s)</p>
          <p className="text-gray-900 font-semibold text-md">
            {formatNumber(station.investorNumber)}
          </p>
        </div>

        {/* Token Issued */}
        <div className="flex flex-col items-center justify-center border border-gray-200 bg-white rounded-lg shadow-sm flex-1 py-6">
          <Image
            src="/proposal/token-issued.png"
            alt="Token Issued"
            width={39}
            height={39}
            className="mb-6"
          />
          <p className="text-gray-500 text-sm font-medium mb-2">Token Issued</p>
          <p className="text-gray-900 font-semibold text-md">
            {station.tokenIssuedOut}%
          </p>
        </div>

        {/* Largest Investment */}
        <div className="flex flex-col items-center justify-center border border-gray-200 bg-white rounded-lg shadow-sm flex-1 py-6">
          <Image
            src="/proposal/trophy.png"
            alt="Largest Investment"
            width={36}
            height={36}
            className="mb-2"
          />
          <p className="text-gray-500 text-sm font-medium mb-1 text-center">
            Largest Investment
          </p>
          <p className="text-gray-900 font-semibold text-md">
            {formatNumber(station.largestInvestment)} token
          </p>
        </div>
      </div>
    </div>
  );
}
