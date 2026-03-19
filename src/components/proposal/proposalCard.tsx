"use client";

import { useEffect, useMemo, useState } from "react";
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
  getCountdownState,
  getFundingProgressPercent,
  getPortGroups,
  parseDdMmYyyy,
} from "./proposalFormatters";

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-medium text-gray-950">{value}</p>
    </div>
  );
}

function ProposalSummaryCard({
  station,
  onClick,
}: {
  station: StationData;
  onClick: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState({
    days: "00",
    hours: "00",
    minutes: "00",
    seconds: "00",
  });

  const openDate = useMemo(
    () => parseDdMmYyyy(station.openInvestmentDate),
    [station.openInvestmentDate],
  );
  const status = getCountdownState(
    station.openInvestmentDate,
    station.isInvestmentEnded,
  );
  const portGroups = getPortGroups(station.portsInfo || []);
  const fundingProgress = getFundingProgressPercent(station);
  const availablePorts = formatNumber(
    station.outletAvailable ?? station.numberOfPort,
  );

  useEffect(() => {
    if (!openDate || station.isInvestmentEnded) return;

    const tick = () => {
      const diff = openDate.getTime() - Date.now();
      const absDiff = Math.abs(diff);
      const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((absDiff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((absDiff / (1000 * 60)) % 60);
      const seconds = Math.floor((absDiff / 1000) % 60);
      setTimeLeft({
        days: String(days).padStart(2, "0"),
        hours: String(hours).padStart(2, "0"),
        minutes: String(minutes).padStart(2, "0"),
        seconds: String(seconds).padStart(2, "0"),
      });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [openDate, station.isInvestmentEnded]);

  const creationTxUrl = station.creationTxHash
    ? `https://hashscan.io/testnet/transaction/${station.creationTxHash}`
    : undefined;

  const locationHashUrl = station.locationHash
    ? `https://hashscan.io/testnet/transaction/${station.locationHash}`
    : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[28px] border border-gray-200 bg-white p-5 text-left transition-colors hover:bg-gray-50 md:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">
            ChargeFrog Station Proposal #
            {String(station.proposalId).padStart(2, "0")}
          </p>
          <h3 className="mt-2 text-2xl font-medium tracking-tight text-gray-950">
            {station.stationName}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {station.locationCategory || "EV charging site"}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
            status.label === "Active"
              ? "border-green-200 bg-green-50 text-green-700"
              : status.label === "Completed"
                ? "border-gray-200 bg-gray-100 text-gray-700"
                : "border-gray-200 bg-gray-50 text-gray-700"
          }`}
        >
          {status.label}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700">
          {availablePorts} outlets live
        </span>
        {portGroups.slice(0, 2).map((group) => (
          <span
            key={group.key}
            className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700"
          >
            {group.count}× {group.type} {group.acdc}
          </span>
        ))}
        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700">
          Go-live {formatDateDisplay(station.timeline?.goLiveDate)}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Investors"
          value={formatNumber(station.investorNumber)}
        />
        <MetricCard label="Funding" value={formatPercent(fundingProgress)} />
        <MetricCard
          label="Lease / Month"
          value={formatCurrency(station.leaseCost?.usdMonthly)}
        />
        <MetricCard
          label="Energy / Month"
          value={`${formatNumber(station.revenueModel?.monthlyEnergySoldKwh)} kWh`}
        />
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 sm:col-span-2 xl:col-span-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-green-700">
            Gross / Month
          </p>
          <p className="mt-1.5 text-sm font-medium text-green-900">
            {formatCurrency(station.revenueModel?.grossMonthlyRevenue?.usd)}
          </p>
        </div>
      </div>

      {status.label !== "Completed" && openDate ? (
        <div
          className={`mt-5 rounded-2xl border px-4 py-4 ${
            status.isActive
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-gray-200 bg-gray-50 text-gray-800"
          }`}
        >
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              [timeLeft.days, "Days"],
              [timeLeft.hours, "Hours"],
              [timeLeft.minutes, "Minutes"],
              [timeLeft.seconds, "Seconds"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="rounded-xl border border-white/70 bg-white/70 px-3 py-3"
              >
                <p className="text-lg font-medium leading-none text-gray-950">
                  {value}
                </p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
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
            onClick={(event) => event.stopPropagation()}
            className="text-sm font-medium text-gray-950 underline underline-offset-4 hover:text-blue-600"
          >
            View on Google Map
          </a>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
              Creation Tx
            </p>
            {creationTxUrl ? (
              <a
                href={creationTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="mt-1 block break-all text-sm font-medium text-gray-950 underline underline-offset-4 hover:text-blue-600"
              >
                {station.creationTxHash}
              </a>
            ) : (
              <p className="mt-1 text-sm text-gray-400">—</p>
            )}
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
              Location Hash
            </p>

            {locationHashUrl ? (
              <a
                href={locationHashUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="mt-1 block break-all text-sm font-medium text-gray-950 underline underline-offset-4 hover:text-blue-600"
              >
                {(station.locationHash)}
              </a>
            ) : (
              <p className="mt-1 text-sm text-gray-400">—</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <p className="text-sm text-gray-500">
          Investment opens {formatDateDisplay(station.openInvestmentDate)}
        </p>
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white">
          <Image
            src="/proposal/right-arrow.png"
            alt="Arrow Icon"
            width={18}
            height={18}
          />
        </div>
      </div>
    </button>
  );
}

export default function ProposalCard() {
  const [activeStation, setActiveStation] = useState<StationData | null>(null);
  const router = useRouter();

  useEffect(() => {
    const activeProposalRef = ref(db, "stations/activeProposal");
    let activeStationRefCleanup: (() => void) | null = null;

    const unsubscribeActiveProposal = onValue(
      activeProposalRef,
      (snapshot: DataSnapshot) => {
        const activeId = snapshot.val();

        if (activeStationRefCleanup) {
          activeStationRefCleanup();
          activeStationRefCleanup = null;
        }

        if (!activeId) {
          setActiveStation(null);
          return;
        }

        const activeStationRef = ref(db, `stations/${activeId}`);
        const unsubscribeActiveStation = onValue(
          activeStationRef,
          (stationSnap: DataSnapshot) => {
            if (stationSnap.exists()) {
              setActiveStation({
                proposalId: String(activeId),
                ...stationSnap.val(),
              });
            } else {
              setActiveStation(null);
            }
          },
        );

        activeStationRefCleanup = () =>
          off(activeStationRef, "value", unsubscribeActiveStation);
      },
    );

    return () => {
      if (activeStationRefCleanup) activeStationRefCleanup();
      off(activeProposalRef, "value", unsubscribeActiveProposal);
    };
  }, []);

  if (!activeStation) {
    return (
      <div className="w-full rounded-[28px] border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        Loading active proposal...
      </div>
    );
  }

  return (
    <ProposalSummaryCard
      station={activeStation}
      onClick={() => router.push(`/proposal/${activeStation.proposalId}`)}
    />
  );
}
