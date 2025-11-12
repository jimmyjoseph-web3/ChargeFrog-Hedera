"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { db } from "@/src/lib/firebaseClient";
import { ref, onValue, off, DataSnapshot } from "firebase/database";

interface StationData {
  proposalId: string;
  stationName: string;
  openInvestmentDate: string;
  [key: string]: any;
}

export default function CompletedProposalCardList() {
  const [completedStations, setCompletedStations] = useState<StationData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Fetch active proposal ID
  useEffect(() => {
    const activeRef = ref(db, "stations/activeProposal");
    const unsubscribe = onValue(activeRef, (snapshot) => {
      setActiveId(snapshot.val());
    });
    return () => off(activeRef);
  }, []);

  // Fetch all stations once activeId is known
  useEffect(() => {
    if (activeId === null) return; // Wait until activeId is ready

    const allStationsRef = ref(db, "stations");

    const unsubscribeStations = onValue(
      allStationsRef,
      (stationsSnap: DataSnapshot) => {
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
          const station = stationsObj[key];
          allStations.push(station);
        }

        setCompletedStations(allStations);
        setLoading(false);
      }
    );

    return () => off(allStationsRef);
  }, [activeId]);

  const handleClick = (id: string) => {
    router.push(`/proposal/${id}`);
  };

  const handleBack = () => {
    router.push("/proposal");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-gray-700 mb-2">
        <img
          src="/station/frog-loader.gif"
          alt="Loading frog"
          className="w-60 h-50 -m-6"
        />
      </div>
    );
  }

  return (
    <div className="relative space-y-5 w-full">
      {/* Back Button */}
      <button
        onClick={handleBack}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity ml-2 mt-6"
      >
        <Image src="/proposal/back.png" alt="Back" width={35} height={35} />
      </button>

      {completedStations.length === 0 ? (
        <div className="w-full border border-gray-100 shadow-sm rounded-xl p-6 text-gray-500 text-center mt-20">
          No completed proposals yet.
        </div>
      ) : (
        <div className="mt-20 space-y-5">
          {completedStations.map((station) => (
            <div
              key={station.proposalId}
              onClick={() => handleClick(station.proposalId)}
              className="relative w-full border border-gray-50 shadow-sm rounded-xl px-6 pt-6 pb-4 bg-white text-left cursor-pointer hover:shadow-md transition-all duration-200"
            >
              <div className="absolute top-4 right-4 text-xs font-medium px-3 py-1 rounded-full bg-gray-200 text-gray-700">
                Completed
              </div>

              <div className="absolute bottom-4.5 right-4">
                <Image
                  src="/proposal/right-arrow.png"
                  alt="Arrow Icon"
                  width={30}
                  height={30}
                />
              </div>

              <h2 className="text-4xl font-medium text-[#00dd00]">
                {String(station.proposalId).padStart(2, "0")}
              </h2>

              <h3 className="text-[1.4rem] font-medium mt-1 mb-1">
                ChargeFrog Station Proposal
              </h3>

              <p className="text-sm text-gray-500 mt-1">
                {station.stationName}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
