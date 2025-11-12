"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import FloatingMenuBar from "@/src/components/floatingMenuBar";
import StickyConfirmInvestmentButton from "@/src/components/proposal/stickyConfirmInvestmentButton";
import InvestmentSuccessDrawer from "@/src/components/proposal/investmentSuccessDrawer";
import { db } from "@/src/lib/firebaseClient";
import { ref, onValue, off, DataSnapshot } from "firebase/database";

type Station = {
  proposalId: string;
  stationName: string;
  openInvestmentDate?: string;
  isInvestmentEnded?: boolean;
  numberOfSharesIssued?: number;
  totalShares?: number;
  [key: string]: any;
};

export default function InvestPage() {
  const params = useParams();
  const stationId = params?.stationId as string;

  const [station, setStation] = useState<Station | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState<number>(0);

  // Drawer state
  const [isSuccessDrawerOpen, setIsSuccessDrawerOpen] = useState(false);
  const [txInfo, setTxInfo] = useState<{ hash: string; amount: number }>({
    hash: "",
    amount: 0,
  });

  useEffect(() => {
    if (!stationId) return;

    const stationRef = ref(db, `stations/${stationId}`);

    const listener = onValue(stationRef, (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      if (data) setStation(data);
    });

    return () => off(stationRef, "value", listener);
  }, [stationId]);

  if (!station) {
    return (
      <>
        <FloatingMenuBar />
        <div className="fixed inset-0 flex items-center justify-center">
          <span className="text-gray-500">Loading...</span>
        </div>
      </>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ""); // remove non-digits
    setInvestmentAmount(Number(value));
  };

  // --- Calculate remaining shares ---
  const numberOfSharesIssued = station.numberOfSharesIssued || 0;
  const totalShares = station.totalShares || 0;
  const sharesLeft = totalShares - numberOfSharesIssued;

  // --- Check if user's amount exceeds available shares ---
  const exceedsAvailable = investmentAmount > sharesLeft;

  return (
    <>
      <FloatingMenuBar />

      {/* Sticky Confirm Button */}
      <StickyConfirmInvestmentButton
       stationId={station.proposalId}
        amount={investmentAmount}
        onTransactionComplete={(hash, amount) => {
          // Save transaction info and open the drawer
          setTxInfo({ hash, amount });
          setIsSuccessDrawerOpen(true);
        }}
      />

      {/* Investment Success Drawer */}
      <InvestmentSuccessDrawer
        open={isSuccessDrawerOpen}
        onClose={() => setIsSuccessDrawerOpen(false)}
        txHash={txInfo.hash}
        amountOfHBARInvested={txInfo.amount}
      />

      {/* Main content */}
      <div
        className="
          fixed inset-x-0 
          bottom-[calc(15vh+9.5rem)] 
          z-[900] flex flex-col items-center justify-center px-4
        "
      >
        {/* Icon */}
        <img
          src="/proposal/station.png"
          alt="Station Icon"
          className="w-15 h-15 mb-6"
        />

        {/* Small grey text */}
        <p className="text-gray-500 text-sm font-medium mb-3">
          ChargeFrog Station Proposal #{station.proposalId}
        </p>

        {/* Station name */}
        <h2 className="text-[2rem] font-medium mb-20">{station.stationName}</h2>

        {/* Number input */}
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={investmentAmount === 0 ? "" : investmentAmount}
          onChange={handleChange}
          className="text-[5rem] text-gray-600 font-normal text-center outline-none border-none w-full max-w-xs"
          placeholder="0"
        />

        {/* Token label */}
        <span className="font-bold text-black text-xl">HBAR</span>

        {/* Conversion */}
        <p className="text-gray-500 text-lg mt-5">
          ={" "}
          <span className="text-[#00dd00] font-semibold">
            {investmentAmount}
          </span>{" "}
          token
        </p>

        {/* Warning box (only if exceeds) */}
        {exceedsAvailable && (
          <div className="bg-red-50 text-red-400 text-center text-sm font-medium mt-8 mb-4 px-4 py-5 rounded-lg mx-8">
            There&apos;s only{" "}
            <span className="font-semibold">{sharesLeft}</span> shares
            left available to invest.
          </div>
        )}
      </div>
    </>
  );
}
