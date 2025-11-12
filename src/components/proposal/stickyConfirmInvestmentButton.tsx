"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { parseEther } from "viem";
import { useAccount, useSendTransaction } from "wagmi";

type StickyConfirmInvestmentButtonProps = {
  stationId: string;
  amount: number; // in HBAR
  onTransactionComplete?: (txHash: string, amount: number) => void;
};

export default function StickyConfirmInvestmentButton({
  stationId,
  amount,
  onTransactionComplete,
}: StickyConfirmInvestmentButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();

  const STATION_ADDRESSES: Record<string, `0x${string}`> = {
    "1": process.env.NEXT_PUBLIC_STATION_1 as `0x${string}`,
    "2": process.env.NEXT_PUBLIC_STATION_2 as `0x${string}`,
    "3": process.env.NEXT_PUBLIC_STATION_3 as `0x${string}`,
  };

  const handleInvest = async () => {
    if (!address) {
      toast.error("Please connect your wallet first");
      return;
    }
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const recipient = STATION_ADDRESSES[stationId];
      if (!recipient) throw new Error(`Station #${stationId} wallet not found`);

      toast.loading("⏳ Sending HBAR...");

      const txHash = await sendTransactionAsync({
        to: recipient,
        value: parseEther(amount.toString()),
      });

      toast.dismiss();
      toast.success("✅ Investment successful!");

      // Optional: Update Firebase or backend
      await fetch("/api/updateAfterInvest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          stationId,
          investAmount: amount
        }),
      });

      onTransactionComplete?.(txHash, amount);
    } catch (error: any) {
      toast.dismiss();
      console.error("❌ Transaction failed:", error);
      toast.error(error.message || "Transaction failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-[calc(15vh+0.9rem)] z-[900] flex justify-center px-4">
      <button
        onClick={handleInvest}
        disabled={isProcessing}
        className={`w-full max-w-md font-medium text-lg rounded-2xl py-4 px-6 shadow-md transition-colors ${
          isProcessing
            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
            : "bg-black text-white hover:bg-gray-900"
        }`}
      >
        {isProcessing ? "Processing transaction..." : "Confirm Investment"}
      </button>
    </div>
  );
}
