"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { db } from "@/src/lib/firebaseClient";
import { ref, onValue, off, DataSnapshot } from "firebase/database";
import FloatingMenuBar from "@/src/components/floatingMenuBar";
import PressAndHoldToStop from "@/src/components/charging/pressAndHoldButton";
import InfoBox from "@/src/components/charging/infoBox";
import FullChargedDrawer from "@/src/components/charging/fullChargedDrawer";
import { applyDiscount } from "@/src/utils/discountHelper";
import { getKWhPerSecond } from "@/src/utils/getKWhPerSecond";
import { useAccount } from "wagmi";

type StationType = {
  id: string;
  stationId: string;
  stationName: string;
  proposalId: string;
  portsInfo: Record<
    string,
    {
      type: string;
      kW: number;
      acdc: string;
      creditPerKWh: number;
    }
  >;
};

export default function ChargingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isWarmingUp, setIsWarmingUp] = useState(true);
  const [hasActiveCharge, setHasActiveCharge] = useState(false);
  const [activeCharge, setActiveCharge] = useState<any>(null);
  const [station, setStation] = useState<StationType | null>(null);
  const [elapsed, setElapsed] = useState("00:00:00");

  const [isInvestor, setIsInvestor] = useState(false);
  const [kWhPerSec, setKWhPerSec] = useState(0);
  const [creditPerKWh, setCreditPerKWh] = useState(0);
  const [totalKWh, setTotalKWh] = useState(0);
  const [totalCredits, setTotalCredits] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [timerRunning, setTimerRunning] = useState(true);
  const [txHash, setTxHash] = useState<string | null>(null);

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const totalsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  //fetch connected USER
  const { address } = useAccount();
  const USER = address ?? "";

  // --- FETCH USER + ACTIVE CHARGE ---
  useEffect(() => {
    if (!address) return;
    async function fetchUserActiveCharge() {
      try {
        const res = await fetch("/api/fetchSingleUser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: USER }),
        });

        if (!res.ok) throw new Error("Failed to fetch user");
        const userData = await res.json();

        setIsInvestor(!!userData.isInvestor);

        if (!userData.activeCharge) {
          router.replace("/map");
          return;
        }

        setHasActiveCharge(true);
        setActiveCharge(userData.activeCharge);
        setIsWarmingUp(userData.activeCharge.isWarmingUp);

        // Listen for changes in activeCharge/isWarmingUp
        const warmingRef = ref(db, `users/${USER}/activeCharge/isWarmingUp`);
        const warmingListener = (snapshot: DataSnapshot) => {
          setIsWarmingUp(snapshot.val() as boolean);
        };
        onValue(warmingRef, warmingListener);
        return () => off(warmingRef, "value", warmingListener);
      } catch (err) {
        console.error("Error fetching user:", err);
      }
    }
    fetchUserActiveCharge();
  }, [router, address]);

  // --- FETCH STATION INFO ---
  useEffect(() => {
    if (!activeCharge?.stationId) return;
    async function fetchStation() {
      try {
        const res = await fetch("/api/fetchSingleStation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stationId: activeCharge.stationId }),
        });

        if (res.ok) {
          const data = await res.json();
          setStation(data);
        }
      } catch (err) {
        console.error("Error fetching station:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStation();
  }, [activeCharge?.stationId]);

  // --- COMPUTE RATES ---
  useEffect(() => {
    if (!station || !activeCharge?.bayNumber) return;
    const port = station.portsInfo?.[activeCharge.bayNumber - 1];
    if (!port) return;

    const discountedPrice = isInvestor
      ? applyDiscount(port.creditPerKWh, 10)
      : port.creditPerKWh;

    setCreditPerKWh(discountedPrice);
    setKWhPerSec(getKWhPerSecond(port.kW));
  }, [station, activeCharge?.bayNumber, isInvestor]);

  // --- TIMER EFFECT ---
  useEffect(() => {
    if (!activeCharge?.startTimestamp) return;

    const updateTimer = () => {
      const diff = Date.now() - activeCharge.startTimestamp;
      const hours = Math.floor(diff / (1000 * 60 * 60))
        .toString()
        .padStart(2, "0");
      const minutes = Math.floor((diff / (1000 * 60)) % 60)
        .toString()
        .padStart(2, "0");
      const seconds = Math.floor((diff / 1000) % 60)
        .toString()
        .padStart(2, "0");
      setElapsed(`${hours}:${minutes}:${seconds}`);
    };

    if (timerRunning) {
      updateTimer();
      timerIntervalRef.current = setInterval(updateTimer, 1000);
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [activeCharge?.startTimestamp, timerRunning]);

  // --- TOTALS EFFECT ---
  useEffect(() => {
    if (!activeCharge?.startTimestamp || !kWhPerSec || !creditPerKWh) return;

    const updateTotals = () => {
      const secondsElapsed = (Date.now() - activeCharge.startTimestamp) / 1000;
      setTotalKWh(secondsElapsed * kWhPerSec);
      setTotalCredits(secondsElapsed * kWhPerSec * creditPerKWh);
    };

    if (timerRunning) {
      updateTotals();
      totalsIntervalRef.current = setInterval(updateTotals, 1000);
    } else if (totalsIntervalRef.current) {
      clearInterval(totalsIntervalRef.current);
      totalsIntervalRef.current = null;
    }

    return () => {
      if (totalsIntervalRef.current) {
        clearInterval(totalsIntervalRef.current);
        totalsIntervalRef.current = null;
      }
    };
  }, [activeCharge?.startTimestamp, kWhPerSec, creditPerKWh, timerRunning]);

  // --- LISTEN FOR CHARGING STATUS CHANGES ---
  useEffect(() => {
    if (!address) return;
    const activeChargeRef = ref(db, `users/${USER}/activeCharge`);

    const listener = (snapshot: DataSnapshot) => {
      const data = snapshot.val();

      // Charging finished successfully
      if (
        data?.totalKWhCharged &&
        data?.totalCreditSpend &&
        data?.isTxCompleted
      ) {
        setTimerRunning(false);
        setDrawerOpen(true);
        return;
      }

      // Charging paused/failed temporarily
      if (
        data?.totalKWhCharged &&
        data?.totalCreditSpend &&
        !data?.isTxCompleted
      ) {
        setTimerRunning(false);
        return;
      }

      // Charging resumed
      if (
        !data?.totalKWhCharged &&
        !data?.totalCreditSpend &&
        data?.startTimestamp
      ) {
        setTimerRunning(true);
        setDrawerOpen(false);
        setActiveCharge(data);
      }
    };

    onValue(activeChargeRef, listener);
    return () => off(activeChargeRef, "value", listener);
  }, [address]);

  // --- RENDER LOADER ---
  if (loading || !hasActiveCharge || !station) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-gray-700">
        <img
          src="/station/frog-loader.gif"
          alt="Loading frog"
          className="w-60 h-50 -m-6"
        />
        <p className="text-lg text-gray-500 font-mono font-semibold">
          Fetching session...
        </p>
      </div>
    );
  }

  // --- WARMING UP SCREEN ---
  if (isWarmingUp) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center p-4">
        <p className="text-[2rem] font-semibold text-black mb-5">
          We&apos;re warming up the <br /> DC charger for you...
        </p>
        <p className="text-gray-600 mb-8">
          This process takes around 30 seconds. <br /> Thanks for your patience!
        </p>
        <Image
          src="/station/warming-up.png"
          alt="Warming up illustration"
          width={350}
          height={350}
          className="mb-10"
        />
        <img
          src="/station/warming-up-loader.gif"
          alt="Loading"
          className="w-40 h-31"
        />
      </div>
    );
  }

  // --- ACTIVE CHARGING SCREEN ---
  return (
    <>
      <div className="flex flex-col items-center justify-start px-5 pt-15">
        {station && (
          <>
            <p className="text-md text-gray-500 mb-1">
              ChargeFrog Station #{station.stationId}
            </p>
            <h2 className="text-[2rem] font-medium text-black mb-2">
              {station.stationName}
            </h2>
          </>
        )}

        <p className="text-2xl font-semibold text-black mb-4">{elapsed}</p>

        {/* Charging animation */}
        <div className="relative w-full max-w-[400px] aspect-square -mb-14 -mt-20 z-[-1] mx-auto">
          <video
            src="/charging/sphere.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover rounded-2xl"
          />
        </div>

        <div className="flex w-full items-stretch gap-2">
          {/* LEFT: Port Info */}
          {station && activeCharge?.bayNumber && (
            <div className="flex flex-col justify-between border border-gray-100 bg-white shadow-sm rounded-2xl px-6 py-3 w-fit">
              <div className="flex items-center justify-center">
                <div className="text-[#00dd00] text-xl font-bold mr-3">
                  {String(activeCharge.bayNumber).padStart(2, "0")}
                </div>
                <div className="flex flex-col items-start text-gray-700 text-xs">
                  <span className="font-semibold text-base">
                    {station.portsInfo?.[activeCharge.bayNumber - 1]?.type}
                  </span>
                  <span>
                    {station.portsInfo?.[activeCharge.bayNumber - 1]?.kW}kW{" "}
                    {station.portsInfo?.[activeCharge.bayNumber - 1]?.acdc}
                  </span>
                </div>
              </div>
              <div className="text-gray-400 text-xs font-medium text-center mt-3">
                Chosen Port
              </div>
            </div>
          )}

          {/* RIGHT: Total Spend */}
          <div className="flex flex-col justify-between border border-gray-100 bg-white shadow-sm rounded-2xl px-3 py-3 flex-1">
            <div className="flex w-full justify-between items-center mt-3 px-3">
              <div className="flex items-baseline">
                <span className="text-lg font-bold text-gray-900">
                  {totalKWh.toFixed(2)}
                </span>
                <span className="text-gray-400 text-xs ml-1">kWh</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-lg font-bold text-gray-900">
                  {totalCredits.toFixed(2)}
                </span>
                <Image
                  src="/charging/bolt-credit.png"
                  alt="Bolt Credit"
                  width={20}
                  height={20}
                />
              </div>
            </div>
            <div className="text-gray-400 text-xs font-medium text-center mt-2">
              Total Spend on Station
            </div>
          </div>
        </div>
      </div>

      {/* PressAndHoldToStop Button */}
      <PressAndHoldToStop
        totalKWhCharged={totalKWh}
        totalCreditSpend={totalCredits}
        stationId={Number(station.stationId)}
        onTxComplete={(hash) => setTxHash(hash)}
      />

      {/* Other components */}
      <InfoBox />
      <FloatingMenuBar />

      {/* Full Charged Drawer */}
      <FullChargedDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        walletAddress={address ?? ""}
        txHash={txHash ?? ""}
      />
    </>
  );
}
