"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";

type InvestButtonProps = {
  station: {
    openInvestmentDate: string;
    isInvestmentEnded: boolean;
  };
};

export default function InvestButton({ station }: InvestButtonProps) {
  const router = useRouter();
  const params = useParams();
  const stationId = params?.stationId as string;

  const [now, setNow] = useState(new Date());
  const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0 });

  //  Memoize parsed date
  const openDate = useMemo(() => {
    const [day, month, year] = station.openInvestmentDate.split("/").map(Number);
    return new Date(year, month - 1, day);
  }, [station.openInvestmentDate]);

  // Update "now" every second
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Derived states
  const isEnded = station.isInvestmentEnded;
  const isUpcoming = !isEnded && now.getTime() < openDate.getTime();
  const isRunning = !isEnded && now.getTime() >= openDate.getTime();

  // Update countdown only if upcoming
  useEffect(() => {
    if (!isUpcoming) return;

    const distance = openDate.getTime() - now.getTime();

    // Prevent negative countdown when passed
    const d = Math.max(0, Math.floor(distance / (1000 * 60 * 60 * 24)));
    const h = Math.max(0, Math.floor((distance / (1000 * 60 * 60)) % 24));
    const m = Math.max(0, Math.floor((distance / (1000 * 60)) % 60));
    const s = Math.max(0, Math.floor((distance / 1000) % 60));

    setCountdown({ d, h, m, s });
  }, [now, openDate, isUpcoming]);

  const handleInvestClick = () => router.push(`/invest/${stationId}`);

  const baseClasses =
    "w-full mt-4 font-medium text-lg rounded-2xl py-4 px-6 shadow-md transition-colors flex flex-col items-center justify-center";

  // Display different button states
  if (isEnded) {
    return (
      <div className="w-full flex justify-center py-4">
        <button
          disabled
          className={`${baseClasses} bg-gray-200 text-gray-500 cursor-not-allowed`}
        >
          Investment round completed
        </button>
      </div>
    );
  }

  if (isRunning) {
    return (
      <div className="w-full flex justify-center py-4">
        <button
          onClick={handleInvestClick}
          className={`${baseClasses} bg-black text-white hover:bg-gray-900`}
        >
          Invest Now
        </button>
      </div>
    );
  }

  // Upcoming
  return (
    <div className="w-full flex justify-center py-4">
      <button
        disabled
        className={`${baseClasses} bg-gray-200 text-gray-500 cursor-not-allowed`}
      >
        <span className="text-sm text-gray-500 mb-1">Open to investment in</span>
        <span className="text-xl font-semibold text-gray-700">
          {countdown.d}D : {countdown.h}H : {countdown.m}M : {countdown.s}S
        </span>
      </button>
    </div>
  );
}
