"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { parseEther } from "viem";
import { useAccount, useSendTransaction } from "wagmi";

import {
  buildFroggyPlannerPrompt,
  ENABLE_FROGGY_PLANNER_AFTER_INVEST,
} from "@/src/lib/froggyPlanner";

type StickyConfirmInvestmentButtonProps = {
  stationId: string;
  amount: number;
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

  async function callFroggyPlannerAfterInvest(args: {
    walletAddress: string;
    stationId: string;
    amount: number;
    txHash: string;
  }) {
    const prompt = buildFroggyPlannerPrompt({
      stationId: args.stationId,
      amount: args.amount,
    });

    const payload = {
      jsonrpc: "2.0",
      id: `invest-${args.stationId}-${Date.now()}`,
      method: "message/send",
      params: {
        message: {
          messageId: `msg-invest-${Date.now()}`,
          role: "user",
          parts: [
            {
              text: prompt,
            },
          ],
          metadata: {
            walletAddress: args.walletAddress,
            stationId: args.stationId,
            amount: args.amount,
            investTxHash: args.txHash,
            source: "post_investment",
          },
        },
      },
    };

    const response = await fetch("/api/froggy-planner-a2a", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `froggy-planner-a2a failed: ${response.status} ${errorText}`,
      );
    }

    return response;
  }

  const handleInvest = async () => {
    if (!address) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const recipient = STATION_ADDRESSES[stationId];
      if (!recipient) {
        throw new Error(`Station #${stationId} wallet not found`);
      }

      toast.loading("Sending HBAR...");

      const txHash = await sendTransactionAsync({
        to: recipient,
        value: parseEther(amount.toString()),
      });

      toast.dismiss();
      toast.success("Investment successful!");

      const registerResponse = await fetch(
        "https://chargefrog-hedera-admin-endpoints.vercel.app/api/registerInvestor",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: address,
            stationId,
            requestedShares: amount,
            investTxHash: txHash,
          }),
        },
      );

      if (!registerResponse.ok) {
        const errorText = await registerResponse.text();
        throw new Error(
          `Failed to register investor: ${registerResponse.status} ${errorText}`,
        );
      }

      const updateResponse = await fetch("/api/updateAfterInvest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          stationId,
          investAmount: amount,
        }),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(
          `Failed to update post-investment flow: ${updateResponse.status} ${errorText}`,
        );
      }

      if (ENABLE_FROGGY_PLANNER_AFTER_INVEST) {
        try {
          await callFroggyPlannerAfterInvest({
            walletAddress: address,
            stationId,
            amount,
            txHash,
          });
        } catch (plannerError) {
          console.error("froggy-planner-a2a post-investment call failed:", plannerError);
        }
      }

      onTransactionComplete?.(txHash, amount);

      toast.success("🎉 You're on the list!");
    } catch (error) {
      toast.dismiss();
      console.error("❌ Transaction or registration failed:", error);

      const message =
        error instanceof Error ? error.message : "Transaction failed";

      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-[calc(15vh+0.9rem)] z-[900] flex justify-center px-4">
      <button
        onClick={handleInvest}
        disabled={isProcessing}
        className={`w-full max-w-md rounded-2xl px-6 py-4 text-lg font-medium shadow-md transition-colors ${
          isProcessing
            ? "cursor-not-allowed bg-gray-200 text-gray-500"
            : "bg-black text-white hover:bg-gray-900"
        }`}
      >
        {isProcessing ? "Processing transaction..." : "Confirm Investment"}
      </button>
    </div>
  );
}