"use client";

import FloatingMenuBar from "@/src/components/floatingMenuBar";
import FloatingMenuBarBgCover from "@/src/components/floatingMenuBarBgCover";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/src/lib/firebaseClient";
import { ref, get } from "firebase/database";
import { useAccount, useDisconnect } from "wagmi";

type UserData = {
  boltCreditAmount: number;
  totalChargeKWh: number;
  offsetCo2: number;
  totalInvestHbar: number;
  totalHbarEarnings: number;
};

export default function Profile() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const router = useRouter();

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      if (!address) return;
      try {
        const walletAddress = address.replace(/[.#$/[\]]/g, "_");
        const userRef = ref(db, `users/${walletAddress}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          setUserData(snapshot.val());
        } else {
          console.warn("User data not found in database");
        }
      } catch (err) {
        console.error("Failed to load user data:", err);
      }
    };
    fetchUserData();
  }, [address]);

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 5)}...${addr.slice(-5)}`;

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      disconnect?.();
      router.push("/");
    } catch (err) {
      console.error("Disconnect failed:", err);
      setIsDisconnecting(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num === undefined || num === null || isNaN(num)) return "0";
    // Only show up to 2 decimals, trim trailing zeros
    return parseFloat(num.toFixed(2)).toString();
  };

  if (!isConnected || !address) return null;

  if (!userData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <main className="flex flex-col items-center justify-start min-h-screen pb-[16vh] px-4">
        <div className="mt-10 relative w-[130px] h-[130px] mx-auto">
          <Image
            src="/profile/pfp.png"
            alt="Profile picture"
            width={130}
            height={130}
            className="rounded-full border-2 border-gray-100 shadow-[0_0_13.5px_0_rgba(0,0,0,0.18)]"
          />
          <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2">
            <div>
              <Image
                src="/profile/verified.png"
                alt="Verified badge"
                width={36}
                height={36}
              />
            </div>
          </div>
        </div>

        {/* Wallet address + disconnect */}
        <div className="flex gap-2 mt-8">
          <div
            onClick={handleCopy}
            className="border border-gray-300 rounded-full px-6 py-3.5 cursor-pointer text-md font-bold font-mono text-gray-700"
          >
            {copied ? (
              <span className="flex items-center gap-2 font-bold text-green-600">
                Copied!
              </span>
            ) : (
              formatAddress(address)
            )}
          </div>

          <button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="border border-gray-300 rounded-full p-3.5 cursor-pointer flex items-center justify-center min-w-[48px] min-h-[48px]"
          >
            {isDisconnecting ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Image
                src="/profile/disconnect.png"
                alt="Disconnect"
                width={20}
                height={20}
              />
            )}
          </button>
        </div>

        {/* Bolt credit */}
        <div className="mt-8 max-w-sm">
          <div className="flex items-center justify-center gap-2 rounded-xl shadow-md border border-gray-50 px-6 py-4 bg-white">
            <span className="text-3xl font-bold text-gray-800">
              {formatNumber(userData.boltCreditAmount)}
            </span>
            <Image
              src="/profile/bolt-credit.png"
              alt="Bolt Credit"
              width={32}
              height={32}
            />
          </div>
          <div className="mt-3 text-center">
            <Link
              href="/credit"
              className="text-sm font-medium text-gray-500 underline hover:text-gray-700"
            >
              Need more Bolt credit?
            </Link>
          </div>
        </div>

        {/* Stats grid */}
        <div className="mt-8 grid grid-cols-2 gap-4 w-80 max-w-sm">
          <div className="flex flex-col items-center justify-center rounded-2xl shadow-sm border border-gray-100 bg-white aspect-square">
            <Image
              src="/profile/total-charge.png"
              alt="Total Charge"
              width={40}
              height={40}
            />
            <p className="mt-4 text-sm font-medium text-gray-700 text-center">
              Total Charge (kWh)
            </p>
            <span className="mt-1 text-lg font-bold text-gray-900">
              {formatNumber(userData.totalChargeKWh)}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center rounded-2xl shadow-sm border border-gray-100 bg-white aspect-square">
            <Image
              src="/profile/co2.png"
              alt="Offset CO2"
              width={40}
              height={40}
            />
            <p className="mt-4 text-sm font-medium text-gray-700 text-center">
              Offset CO2 (kg)
            </p>
            <span className="mt-1 text-lg font-bold text-gray-900">
              {formatNumber(userData.offsetCo2)}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center rounded-2xl shadow-sm border border-gray-100 bg-white aspect-square">
            <Image
              src="/profile/invest.png"
              alt="Invest"
              width={40}
              height={40}
            />
            <p className="mt-4 text-sm font-medium text-gray-700 text-center">
              Invest (HBAR)
            </p>
            <span className="mt-1 text-lg font-bold text-gray-900">
              {formatNumber(userData.totalInvestHbar)}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center rounded-2xl shadow-sm border border-gray-100 bg-white aspect-square">
            <Image
              src="/profile/earning.png"
              alt="Earnings"
              width={40}
              height={40}
            />
            <p className="mt-4 text-sm font-medium text-gray-700 text-center">
              Earnings (HBAR)
            </p>
            <span className="mt-1 text-lg font-bold text-gray-900">
              {formatNumber(userData.totalHbarEarnings)}
            </span>
          </div>
        </div>
      </main>

      <FloatingMenuBar />
      <FloatingMenuBarBgCover />
    </>
  );
}
