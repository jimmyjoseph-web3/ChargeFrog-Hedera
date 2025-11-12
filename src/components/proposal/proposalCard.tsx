"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebaseClient";
import { ref, onValue, off, DataSnapshot } from "firebase/database";

interface StationData {
  proposalId: string;
  stationName: string;
  openInvestmentDate: string; // format: "31/10/2025"
  [key: string]: any;
}

export default function ProposalCard() {
  const [activeStation, setActiveStation] = useState<StationData | null>(null);
  const [timeLeft, setTimeLeft] = useState({
    days: "00",
    hours: "00",
    minutes: "00",
    seconds: "00",
  });
  const [isActive, setIsActive] = useState(false);
  const router = useRouter();

  // Fetch activeProposal and its station data
  useEffect(() => {
    const stationsRef = ref(db, "stations/activeProposal");

    const unsubscribe = onValue(stationsRef, (snapshot: DataSnapshot) => {
      const activeId = snapshot.val();
      if (activeId) {
        const activeStationRef = ref(db, `stations/${activeId}`);
        onValue(activeStationRef, (stationSnap: DataSnapshot) => {
          if (stationSnap.exists()) {
            setActiveStation(stationSnap.val());
          }
        });
      }
    });

    return () => off(stationsRef);
  }, []);

  // Countdown / Count-up logic
  useEffect(() => {
    if (!activeStation?.openInvestmentDate) return;

    const [day, month, year] = activeStation.openInvestmentDate.split("/");
    const target = new Date(`${year}-${month}-${day}T00:00:00`).getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const diff = target - now;
      const isPast = diff <= 0;
      setIsActive(isPast);

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
    }, 1000);

    return () => clearInterval(interval);
  }, [activeStation]);

  if (!activeStation) {
    return (
      <div className="w-full border border-gray-100 shadow-sm rounded-xl p-6 text-gray-500 text-center">
        Loading active proposal...
      </div>
    );
  }

  // Handle Card Click
  const handleClick = () => {
    router.push(`/proposal/${activeStation.proposalId}`);
  };

  return (
    <div
      onClick={handleClick}
      className="relative w-full border border-gray-50 shadow-sm rounded-xl px-6 pt-6 pb-4 bg-white text-left cursor-pointer hover:shadow-md transition-all duration-200"
    >
      {/* Top Right Pill */}
      <div
        className={`absolute top-4 right-4 text-xs font-medium px-3 py-1 rounded-full ${
          isActive
            ? "bg-green-100 text-green-600"
            : "bg-gray-100 text-gray-700"
        }`}
      >
        {isActive ? "Active" : "Upcoming"}
      </div>

      {/* Right Arrow */}
      <div className="absolute bottom-4.5 right-4">
        <Image
          src="/proposal/right-arrow.png"
          alt="Arrow Icon"
          width={30}
          height={30}
        />
      </div>

      {/* Proposal ID */}
      <h2 className="text-4xl font-medium text-[#00dd00]">
        {String(activeStation.proposalId).padStart(2, "0")}
      </h2>

      {/* Fixed Title */}
      <h3 className="text-[1.4rem] font-medium mt-1 mb-1">
        ChargeFrog Station Proposal
      </h3>

      {/* Station Name */}
      <p className="text-sm text-gray-500 mt-1">{activeStation.stationName}</p>

      {/* Countdown / Count-up Box */}
      <div
        className={`mt-5 rounded-xl px-5 py-4 inline-block ${
          isActive ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-700"
        }`}
      >
        <div className="grid grid-cols-4 gap-3 font-bold text-lg tracking-wide">
          <div className="flex flex-col items-center">
            <span>{timeLeft.days}</span>
            <span
              className={`text-xs font-normal mt-1 ${
                isActive ? "text-green-500" : "text-gray-400"
              }`}
            >
              Days
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span>{timeLeft.hours}</span>
            <span
              className={`text-xs font-normal mt-1 ${
                isActive ? "text-green-500" : "text-gray-400"
              }`}
            >
              Hours
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span>{timeLeft.minutes}</span>
            <span
              className={`text-xs font-normal mt-1 ${
                isActive ? "text-green-500" : "text-gray-400"
              }`}
            >
              Minutes
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span>{timeLeft.seconds}</span>
            <span
              className={`text-xs font-normal mt-1 ${
                isActive ? "text-green-500" : "text-gray-400"
              }`}
            >
              Seconds
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
