"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import FloatingMenuBar from "@/src/components/floatingMenuBar";
import FloatingMenuBarBgCover from "@/src/components/floatingMenuBarBgCover";
import PerkDrawer from "@/src/components/map/perkDrawer";
import StationRenderTemplate from "@/src/components/stationRenderTemplate";
import PageButton from "@/src/components/nonStickyPageButton";
import PlugInPortDrawer from "@/src/components/charging/plugInPortDrawer";
import StationHeader from "@/src/components/station/stationHeader";
import PortCard from "@/src/components/station/portCard";
import toast from "react-hot-toast";

import { getDistanceKm } from "@/src/utils/getDistanceKm";

import { db } from "@/src/lib/firebaseClient";
import { ref, onValue, off, DataSnapshot } from "firebase/database";

import { useAccount } from "wagmi";

interface StationData {
  id: string;
  stationName: string;
  proposalId: string;
  bannerImageUrl: string;
  googleMapLink: string;
  numberOfPort: number;
  locationCoordinates: string;
  locationCategory: string;
  portsInfo: any[];
  [key: string]: any;
}

interface UserData {
  isInvestor: boolean;
  recentInvestment: string;
  [key: string]: any;
}

export default function Station() {
  const { stationId } = useParams();
  const router = useRouter();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [station, setStation] = useState<StationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBay, setSelectedBay] = useState<string | null>(null);
  const [isPlugInDrawerOpen, setIsPlugInDrawerOpen] = useState(false);
  const [boltCredit, setBoltCredit] = useState<number | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [DISCOUNT, setDISCOUNT] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [drawerButtonText, setDrawerButtonText] = useState("Cancel");

  const selectedPort = station?.portsInfo?.[Number(selectedBay) - 1] || null;

  // --- wagmi hook to get connected wallet ---
  const { address, isConnected } = useAccount();

  // --- State to store wallet address as USER ---
  const [USER, setUSER] = useState<string>("");

  useEffect(() => {
    if (address) {
      setUSER(address);
    } else {
      setUSER(""); // reset if disconnected
    }
  }, [address]);

  // --- Get user location ---
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setUserCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        (err) => console.warn("Could not get user location:", err)
      );
    }
  }, []);

  // --- Fetch user ---
  useEffect(() => {
    if (!USER) return;
    async function fetchUser() {
      try {
        const res = await fetch("/api/fetchSingleUser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: USER }),
        });
        if (!res.ok) throw new Error("Failed to fetch user data");
        const data = await res.json();
        if (data) {
          setUserData(data);
          setDISCOUNT(Boolean(data.isInvestor));
          if (data.isInvestor) setTimeout(() => setIsDrawerOpen(true), 500);
        }
      } catch (err) {
        console.error("Error fetching user:", err);
      }
    }
    fetchUser();
  }, [USER]);

  // --- Listen to Bolt credit ---
  useEffect(() => {
    if (!USER) return;

    const boltRef = ref(db, `users/${USER}/boltCreditAmount`);

    const listener = (snapshot: DataSnapshot) => {
      if (snapshot.exists()) {
        setBoltCredit(snapshot.val());
      } else {
        setBoltCredit(0);
      }
    };

    onValue(boltRef, listener);
    return () => off(boltRef, "value", listener);
  }, [USER]);

  // --- Fetch station ---
  useEffect(() => {
    async function fetchStation() {
      try {
        setLoading(true);
        const res = await fetch("/api/fetchSingleStation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stationId }),
        });
        if (!res.ok) throw new Error("Failed to fetch station data");
        const data = await res.json();
        setStation(data);
      } catch (err) {
        console.error("Error fetching station:", err);
      } finally {
        setLoading(false);
      }
    }
    if (stationId) fetchStation();
  }, [stationId]);

  // --- Listen to pendingCharge/isConnected when drawer open ---
  useEffect(() => {
    if (!isPlugInDrawerOpen) return;

    const pendingRef = ref(db, `users/${USER}/pendingCharge/isConnected`);

    const listener = (snapshot: DataSnapshot) => {
      if (snapshot.exists() && snapshot.val() === true) {
        setDrawerButtonText("Start charging");
      } else {
        setDrawerButtonText("Cancel");
      }
    };

    onValue(pendingRef, listener);

    return () => off(pendingRef, "value", listener);
  }, [isPlugInDrawerOpen, USER]);

  const handleDrawerButtonClick = async () => {
    if (drawerButtonText === "Cancel") {
      setIsPlugInDrawerOpen(false);
      try {
        await fetch("/api/removePendingCharge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: USER }),
        });
      } catch (err) {
        console.error("Error removing pending charge:", err);
      }
      return;
    }

    if (drawerButtonText === "Start charging") {
      if (!station) return;

      try {
        const selectedPort = station.portsInfo?.find(
          (p) => String(p.bayNumber) === String(selectedBay)
        );
        if (!selectedPort) return alert("Selected port not found!");

        const portType = selectedPort.acdc;
        const isWarmingUp = portType === "DC";

        const addRes = await fetch("/api/addActiveCharge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: USER,
            stationId: stationId,
            bayNumber: Number(selectedBay),
            isWarmingUp,
          }),
        });

        const addResult = await addRes.json();
        if (!addRes.ok) {
          console.error("Failed to add active charge:", addResult);
          return;
        }

        if (portType !== "DC") {
          fetch("/api/startActiveCharge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress: USER }),
          })
            .then((res) => res.json())
            .then((data) => console.log("Active charge started:", data))
            .catch((err) =>
              console.error("Failed to start active charge:", err)
            );
        }

        router.push("/charging");

        fetch("/api/removePendingCharge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: USER }),
        })
          .then((res) => res.json())
          .then((data) => console.log("Pending charge removed:", data))
          .catch((err) =>
            console.error("Failed to remove pending charge:", err)
          );
      } catch (err) {
        console.error("Error starting charge:", err);
        alert("Failed to start charging. Please try again.");
      }
    }
  };

  if (loading || !station) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-gray-700">
        <img
          src="/station/frog-loader.gif"
          alt="Loading frog"
          className="w-60 h-50 -m-6"
        />
        <p className="text-lg text-gray-500 font-mono font-semibold">
          Catching Your Station...
        </p>
      </div>
    );
  }

  return (
    <>
      <FloatingMenuBar />
      <FloatingMenuBarBgCover />

      <StationRenderTemplate bannerImageUrl={station.bannerImageUrl}>
        <div className="flex flex-col gap-4">
          <StationHeader
            station={station}
            distance={getDistanceKm(station.locationCoordinates, userCoords)}
          />

          <div className="flex gap-2 flex-wrap mt-2">
            <span className="px-4 py-1 rounded-full bg-gray-100 text-gray-800 text-sm font-semibold">
              {station.locationCategory}
            </span>
            <span className="px-4 py-1 rounded-full bg-gray-100 text-gray-800 text-sm font-semibold">
              Public
            </span>
            <span className="px-4 py-1 rounded-full bg-gray-100 text-gray-800 text-sm font-semibold">
              24 Hours Operation
            </span>
          </div>

          <p className="text-md font-semibold text-black mt-6">
            Select a bay to start charging
          </p>

          <div className="flex flex-col gap-3">
            {station.portsInfo?.map((port: any, idx: number) => (
              <PortCard
                key={idx}
                port={port}
                selectedBay={selectedBay}
                setSelectedBay={setSelectedBay}
                discount={DISCOUNT}
                idx={idx}
              />
            ))}
          </div>

          <PageButton
            text="Unlock selected bay"
            walletAddress={USER}
            onClick={async () => {
              if (!selectedBay) return toast.error("Please select a bay!");
              if (!userData) return toast.error("User data not loaded yet.");

              if (boltCredit === null)
                return toast.error("Checking your Bolt balance...");
              if (boltCredit < 10) {
                toast.error(
                  "You need at least 10 Bolt in your account to start a charging session."
                );
                return;
              }

              try {
                const res = await fetch("/api/addPendingCharge", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    walletAddress: USER,
                    stationId,
                    bayNumber: selectedBay,
                  }),
                });
                const result = await res.json();
                if (!res.ok)
                  throw new Error(result.error || "Failed to add pending charge");

                setIsPlugInDrawerOpen(true);
              } catch (err) {
                console.error("Error adding pending charge:", err);
                toast.error("Failed to add pending charge. Please try again.");
              }
            }}
          />
        </div>
      </StationRenderTemplate>

      {userData?.isInvestor && (
        <PerkDrawer
          open={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          recentInvestStation={userData.recentInvestment}
        />
      )}

      {selectedPort && (
        <PlugInPortDrawer
          open={isPlugInDrawerOpen}
          onClose={handleDrawerButtonClick}
          stationData={{
            id: station.id,
            stationName: station.stationName,
            proposalId: station.proposalId,
            type: selectedPort.type,
            kW: selectedPort.kW,
            acdc: selectedPort.acdc,
          }}
          portBayNumber={Number(selectedBay)}
          drawerButton={{
            text: drawerButtonText,
            onClick: handleDrawerButtonClick,
          }}
          userWallet={USER}
        />
      )}
    </>
  );
}
