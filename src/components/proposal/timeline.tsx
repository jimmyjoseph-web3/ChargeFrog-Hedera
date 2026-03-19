"use client";

import { StationData, formatDateDisplay } from "./proposalFormatters";

export default function Timeline({ station }: { station: StationData }) {
  const startDate = station.timeline?.startDate;
  const goLiveDate = station.timeline?.goLiveDate;
  const setupDuration = startDate && goLiveDate
    ? `${formatDateDisplay(startDate)} → ${formatDateDisplay(goLiveDate)}`
    : "Timeline unavailable";

  return (
    <div className="mt-8">
      <h2 className="mb-4 text-xl font-medium text-gray-900">Timeline</h2>

      <div className="relative flex flex-col items-center rounded-xl border border-gray-100 bg-white py-10 shadow-sm">
        <div className="text-center mb-2">
          <p className="text-sm font-medium text-gray-600">Estimated Start Date</p>
          <p className="font-semibold text-black">{formatDateDisplay(startDate)}</p>
        </div>

        <div className="relative flex w-full justify-center">
          <div className="relative z-0 h-40 w-0.5 bg-[#00dd00]" />
          <div className="absolute left-0 top-1/2 w-full -translate-y-1/2 text-center z-10">
            <div className="inline-block bg-white px-3 text-sm font-medium text-gray-600">{setupDuration}</div>
          </div>
          <div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 rounded-full bg-[#00dd00]" />
          <div className="absolute bottom-0 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-[#00dd00]" />
        </div>

        <div className="mt-2 text-center">
          <p className="text-sm font-medium text-gray-600">Estimated Go-Live Date</p>
          <p className="font-semibold text-black">{formatDateDisplay(goLiveDate)}</p>
        </div>
      </div>
    </div>
  );
}
