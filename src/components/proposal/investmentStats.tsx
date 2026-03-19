"use client";

import Image from "next/image";
import { StationData, formatNumber, formatPercent, getFundingProgressPercent } from "./proposalFormatters";

export default function InvestmentStats({ station }: { station: StationData }) {
  const fundingProgress = getFundingProgressPercent(station);

  return (
    <div className="mt-10">
      <h2 className="mb-4 text-xl font-medium text-gray-900">Investment Stats</h2>

      <div className="flex justify-between gap-2 items-stretch">
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-gray-200 bg-white py-6 shadow-sm">
          <Image src="/proposal/investor.png" alt="Investor" width={39} height={39} className="mb-6" />
          <p className="mb-2 text-sm font-medium text-gray-500">Investor(s)</p>
          <p className="text-md font-semibold text-gray-900">{formatNumber(station.investorNumber)}</p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-gray-200 bg-white py-6 shadow-sm">
          <Image src="/proposal/token-issued.png" alt="Funding Progress" width={39} height={39} className="mb-6" />
          <p className="mb-2 text-sm font-medium text-gray-500">Funding Progress</p>
          <p className="text-md font-semibold text-gray-900">{formatPercent(fundingProgress)}</p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-gray-200 bg-white py-6 shadow-sm">
          <Image src="/proposal/trophy.png" alt="Largest Investment" width={36} height={36} className="mb-2" />
          <p className="mb-1 text-center text-sm font-medium text-gray-500">Largest Investment</p>
          <p className="text-md font-semibold text-gray-900">{formatNumber(station.largestInvestment)} token</p>
        </div>
      </div>
    </div>
  );
}
