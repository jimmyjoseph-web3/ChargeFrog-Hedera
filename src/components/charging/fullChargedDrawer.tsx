"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { ref, onValue, off, DataSnapshot } from "firebase/database";
import { db } from "@/src/lib/firebaseClient";
import { Drawer, DrawerContent } from "@/src/components/ui/drawer";
import DrawerButton from "../drawerButton";
import { convertKwhToCo2Offset } from "@/src/utils/co2Offset";
import toast from "react-hot-toast";

function shortenTxHash(hash: string): string {
  if (!hash || hash.length <= 10) return hash;
  return `${hash.slice(0, 5)}...${hash.slice(-5)}`;
}

type FullChargedDrawerProps = {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
  txHash: string;
};

export default function FullChargedDrawer({
  open,
  onClose,
  walletAddress,
  txHash,
}: FullChargedDrawerProps) {
  const router = useRouter();
  const [totalKWhCharged, setTotalKWhCharged] = useState<number>(0);
  const [totalCreditSpend, setTotalCreditSpend] = useState<number>(0);
  const [isTxCompleted, setIsTxCompleted] = useState(false);

  // Track last wipe value so we detect increments
  const lastWipeRef = useRef<number | null>(null);

  // -------------------------------
  // Listen to currentWipeRange
  // -------------------------------
  useEffect(() => {
    if (!walletAddress) return;

    const wipeRef = ref(db, `users/${walletAddress}/currentWipeRange`);

    const listener = (snapshot: DataSnapshot) => {
      const value = snapshot.val();
      if (value === undefined || value === null) return;

      const numericValue = Number(value);

      // Only trigger when wipe range increased
      if (
        lastWipeRef.current !== null &&
        numericValue > lastWipeRef.current
      ) {
        // Start mock wipe
        const id = toast.loading(
          "Another kilo carbon offset! Wiping in progress..."
        );

        setTimeout(() => {
          toast.dismiss(id);
          toast.success("Wipe completed!");
        }, 5000);
      }

      lastWipeRef.current = numericValue;
    };

    onValue(wipeRef, listener);
    return () => off(wipeRef, "value", listener);
  }, [walletAddress]);

  // -------------------------------
  // Listen to activeCharge
  // -------------------------------
  useEffect(() => {
    if (!walletAddress) return;

    const activeChargeRef = ref(db, `users/${walletAddress}/activeCharge`);
    const listener = (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      if (!data) return;

      if (data.totalKWhCharged !== undefined)
        setTotalKWhCharged(data.totalKWhCharged);
      if (data.totalCreditSpend !== undefined)
        setTotalCreditSpend(data.totalCreditSpend);
      if (data.isTxCompleted) setIsTxCompleted(true);
    };

    onValue(activeChargeRef, listener);
    return () => off(activeChargeRef, "value", listener);
  }, [walletAddress]);

  const shortened = shortenTxHash(txHash);
  const txUrl = `https://hashscan.io/testnet/transaction/${txHash}`;

  // Compute CO₂ offset (in grams)
  const co2Offset = convertKwhToCo2Offset(totalKWhCharged);

  // Remove activeCharge API
  const removeActiveCharge = async () => {
    if (!walletAddress) return;
    try {
      await fetch("/api/removeActiveCharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
    } catch (err) {
      console.error("Failed to remove activeCharge:", err);
    }
  };

  const handleBack = async () => {
    await removeActiveCharge();
    onClose();
    router.push("/map");
  };

  return (
    <Drawer open={open && isTxCompleted}>
      <DrawerContent className="w-full max-w-full px-4 border-none bg-white">
        <div className="mx-auto w-full max-w-md text-center pb-10">
          {/* Illustration */}
          <Image
            src="/charging/fully-charged.png"
            alt="Fully Charged"
            width={250}
            height={250}
            className="mx-auto mt-8 mb-5"
          />

          <h2 className="text-[2.2rem] font-medium text-gray-900 mb-3">
            You’re fully charged!
          </h2>

          <p className="text-md text-gray-700 leading-relaxed mb-6">
            Thanks for charging with ChargeFrog.
          </p>

          {/* Summary Card */}
          <div className="px-18">
            <div className="flex flex-col justify-between border border-gray-100 bg-white shadow-sm rounded-2xl px-3 py-3 flex-1 mb-6">
              <div className="flex w-full justify-between items-center mt-3 px-3">
                <div className="flex items-baseline">
                  <span className="text-lg font-bold text-gray-900">
                    {totalKWhCharged.toFixed(2)}
                  </span>
                  <span className="text-gray-400 text-xs ml-1">kWh</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-lg font-bold text-gray-900">
                    {totalCreditSpend.toFixed(2)}
                  </span>
                  <Image
                    src="/charging/bolt-credit.png"
                    alt="Bolt Credit"
                    width={20}
                    height={20}
                    className="object-contain"
                  />
                </div>
              </div>
              <div className="text-gray-400 text-xs font-medium text-center mt-4">
                Total Spend on Station
              </div>
            </div>
          </div>

          {/* Transaction Hash */}
          {txHash && (
            <>
              <Link
                href={txUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-gray-700 underline text-lg mt-2 inline-block"
              >
                {shortened}
              </Link>

              {/* On-chain carbon offset link */}
              {co2Offset > 100 && (
                <Link
                  href="https://hashscan.io/testnet/account/0.0.7258185/operations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 text-lg underline mt-2 block"
                >
                  On-chain carbon offset record
                </Link>
              )}
            </>
          )}

          <div className="mt-10 w-full">
            <DrawerButton text="Back to map" onClick={handleBack} />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
