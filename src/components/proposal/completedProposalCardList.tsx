"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { db } from "@/src/lib/firebaseClient";
import { ref, onValue, off, DataSnapshot } from "firebase/database";
import {
  StationData,
  formatCurrency,
  formatDateDisplay,
  formatNumber,
  formatPercent,
  getFundingProgressPercent,
  getPortGroups,
} from "./proposalFormatters";

export default function CompletedProposalCardList() {
  const [completedStations, setCompletedStations] = useState<StationData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const activeRef = ref(db, "stations/activeProposal");
    const unsubscribe = onValue(activeRef, (snapshot) => {
      const value = snapshot.val();
      setActiveId(value ? String(value) : null);
    });
    return () => off(activeRef);
  }, []);

  useEffect(() => {
    if (activeId === null) return;

    const allStationsRef = ref(db, "stations");

    const unsubscribeStations = onValue(allStationsRef, (stationsSnap: DataSnapshot) => {
      if (!stationsSnap.exists()) {
        setCompletedStations([]);
        setLoading(false);
        return;
      }

      const stationsObj = stationsSnap.val();
      const allStations: StationData[] = [];

      for (const key in stationsObj) {
        if (key === "activeProposal") continue;
        if (key === String(activeId)) continue;
        allStations.push({ proposalId: String(key), ...stationsObj[key] });
      }

      setCompletedStations(allStations);
      setLoading(false);
    });

    return () => off(allStationsRef);
  }, [activeId]);

  if (loading) {
    return (
      <div className="mb-2 flex h-screen flex-col items-center justify-center text-gray-700">
        <img src="/station/frog-loader.gif" alt="Loading frog" className="-m-6 h-50 w-60" />
      </div>
    );
  }

  return (
    <div className="relative w-full space-y-5">
      <button onClick={() => router.push("/proposal")} className="ml-2 mt-6 flex items-center gap-2 transition-opacity hover:opacity-80">
        <Image src="/proposal/back.png" alt="Back" width={35} height={35} />
      </button>

      {completedStations.length === 0 ? (
        <div className="mt-20 w-full rounded-2xl border border-gray-100 bg-white p-6 text-center text-gray-500 shadow-sm">
          No completed proposals yet.
        </div>
      ) : (
        <div className="mt-20 space-y-5">
          {completedStations.map((station) => {
            const portGroups = getPortGroups(station.portsInfo || []);
            const fundingProgress = getFundingProgressPercent(station);

            return (
              <div
                key={station.proposalId}
                onClick={() => router.push(`/proposal/${station.proposalId}`)}
                className="relative w-full cursor-pointer overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="absolute right-4 top-4 rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
                  Completed
                </div>

                <div className="pr-14">
                  <p className="text-sm font-medium text-gray-500">ChargeFrog Station Proposal #{String(station.proposalId).padStart(2, "0")}</p>
                  <h2 className="mt-2 text-[1.35rem] font-semibold text-gray-950">{station.stationName}</h2>
                  <p className="mt-1 text-sm text-gray-500">{station.locationCategory || "EV charging site"}</p>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {formatNumber(station.outletAvailable ?? station.numberOfPort)} outlets
                  </span>
                  {portGroups.slice(0, 2).map((group) => (
                    <span key={group.key} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {group.count}× {group.type} {group.acdc}
                    </span>
                  ))}
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    Go-live {formatDateDisplay(station.timeline?.goLiveDate)}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Investors</p>
                    <p className="mt-1 text-base font-semibold text-gray-900">{formatNumber(station.investorNumber)}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Funding</p>
                    <p className="mt-1 text-base font-semibold text-gray-900">{formatPercent(fundingProgress)}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Lease / Month</p>
                    <p className="mt-1 text-base font-semibold text-gray-900">{formatCurrency(station.leaseCost?.usdMonthly)}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Gross / Month</p>
                    <p className="mt-1 text-base font-semibold text-gray-900">{formatCurrency(station.revenueModel?.grossMonthlyRevenue?.usd)}</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <p className="text-sm text-gray-500">Opened {formatDateDisplay(station.openInvestmentDate)}</p>
                  <Image src="/proposal/right-arrow.png" alt="Arrow Icon" width={30} height={30} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
