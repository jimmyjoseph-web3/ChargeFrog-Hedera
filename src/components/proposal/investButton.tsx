"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type InvestButtonProps = {
  station: {
    openInvestmentDate?: string;
    isInvestmentEnded?: boolean;
  };
};

function parseDdMmYyyy(value?: string) {
  if (!value) return null;

  const parts = value.split("/").map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const [day, month, year] = parts;
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export default function InvestButton({ station }: InvestButtonProps) {
  const router = useRouter();
  const params = useParams();
  const stationId = params?.stationId as string;

  const [now, setNow] = useState(new Date());
  const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0 });

  const openDate = useMemo(() => {
    return parseDdMmYyyy(station.openInvestmentDate);
  }, [station.openInvestmentDate]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const isEnded = station.isInvestmentEnded ?? false;
  const hasValidOpenDate = openDate !== null;
  const isUpcoming =
    !isEnded && hasValidOpenDate && now.getTime() < openDate.getTime();
  const isRunning =
    !isEnded && (!hasValidOpenDate || now.getTime() >= openDate.getTime());

  useEffect(() => {
    if (!isUpcoming || !openDate) {
      setCountdown({ d: 0, h: 0, m: 0, s: 0 });
      return;
    }

    const distance = openDate.getTime() - now.getTime();

    const d = Math.max(0, Math.floor(distance / (1000 * 60 * 60 * 24)));
    const h = Math.max(0, Math.floor((distance / (1000 * 60 * 60)) % 24));
    const m = Math.max(0, Math.floor((distance / (1000 * 60)) % 60));
    const s = Math.max(0, Math.floor((distance / 1000) % 60));

    setCountdown({ d, h, m, s });
  }, [now, openDate, isUpcoming]);

  const handleInvestClick = () => {
    if (!stationId) return;
    router.push(`/invest/${stationId}`);
  };

  const baseClasses =
    "mt-4 flex w-full flex-col items-center justify-center rounded-2xl px-6 py-4 text-lg font-medium transition-colors";

  if (isEnded) {
    return (
      <div className="flex w-full justify-center py-4">
        <button
          disabled
          className={`${baseClasses} cursor-not-allowed bg-gray-200 text-gray-500`}
        >
          Investment round completed
        </button>
      </div>
    );
  }

  if (isRunning) {
    return (
      <div className="flex w-full justify-center py-4">
        <button
          onClick={handleInvestClick}
          className={`${baseClasses} bg-black text-white hover:bg-gray-900`}
        >
          Invest Now
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-center py-4">
      <button
        disabled
        className={`${baseClasses} cursor-not-allowed bg-gray-200 text-gray-500`}
      >
        <span className="mb-1 text-sm text-gray-500">Open to investment in</span>
        <span className="text-xl font-semibold text-gray-700">
          {countdown.d}D : {countdown.h}H : {countdown.m}M : {countdown.s}S
        </span>
      </button>
    </div>
  );
}