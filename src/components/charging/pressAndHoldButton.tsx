"use client";

import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";

// --- Bolt ABI (minimal) ---
const boltAbi = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "stationId", type: "uint256" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "spendBolt",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

type PressAndHoldToStopProps = {
  totalKWhCharged: number;
  totalCreditSpend: number; // human units
  holdDuration?: number;
  stationId: number;
  onStop?: () => void;
  onTxComplete?: (txHash: string) => void;
};

export default function PressAndHoldToStop({
  totalKWhCharged,
  totalCreditSpend,
  holdDuration = 2000,
  stationId,
  onStop,
  onTxComplete,
}: PressAndHoldToStopProps) {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [status, setStatus] = useState<"idle" | "processing" | "completed">(
    "idle"
  );
  const [spendTx, setSpendTx] = useState<string>("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const boltAddress = process.env.NEXT_PUBLIC_BOLT as `0x${string}`;
  const boltAddressTyped = boltAddress as `0x${string}`;
  const userAddressTyped = address as `0x${string}`;

  if (!publicClient) {
    toast.error("Public client not ready");
    setStatus("idle");
    return;
  }

  // --- HOLD START ---
  const startHold = () => {
    if (status !== "idle") return;
    setIsHolding(true);
    startTimeRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - (startTimeRef.current ?? 0);
      const newProgress = Math.min(1, elapsed / holdDuration);
      setProgress(newProgress);
      if (newProgress >= 1) stopHold(true);
    }, 20);
  };

  // --- HOLD STOP ---
  const stopHold = async (completed = false) => {
    setIsHolding(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!completed && progress > 0 && progress < 1) {
      if (navigator.vibrate) navigator.vibrate(100);
    }

    if (completed) {
      if (!walletClient || !address) {
        toast.error("Wallet not connected");
        setProgress(0);
        return;
      }

      if (navigator.vibrate) navigator.vibrate([50, 80, 50]);
      setStatus("processing");

      try {
        // --- Compute amount in 18 decimals ---
        const decimals = 18;
        const amountToSpend = BigInt(totalCreditSpend * 10 ** decimals);

        // --- 1️⃣ Approve BOLT if needed ---
        const allowance = (await publicClient.readContract({
          address: boltAddressTyped,
          abi: boltAbi,
          functionName: "allowance",
          args: [userAddressTyped, boltAddressTyped],
        })) as bigint;

        if (allowance < amountToSpend) {
          toast.loading("Approve your Bolt spending...");
          await walletClient.writeContract({
            address: boltAddressTyped,
            abi: boltAbi,
            functionName: "approve",
            args: [boltAddressTyped, amountToSpend],
          });
          toast.dismiss();
          toast.success("You had approved the spending!");
        }

        // --- 2️⃣ Spend BOLT ---
        toast.loading("Payment processing...");
        const spendTxHash = await walletClient.writeContract({
          address: boltAddress,
          abi: boltAbi,
          functionName: "spendBolt",
          args: [stationId, amountToSpend],
        });
        toast.dismiss();
        toast.success("BOLT Payment Success!");

        setSpendTx(spendTxHash);

        // 1. Mint loading
        const mintToastId = toast.loading(
          "Minting CarbonFrog to record your carbon offset..."
        );

        // After 5s → remove mint loading, then show mint success
        setTimeout(() => {
          toast.dismiss(mintToastId);
          toast.success("CarbonFrog Minted!");

          // 2. Wipe loading
          const wipeToastId = toast.loading("Another kilo offset! Wiping...");

          // After 5s → remove wipe loading, then show wipe success
          setTimeout(() => {
            toast.dismiss(wipeToastId);
            toast.success("Wipe completed!");
          }, 5000);
        }, 5000);

        await fetch("/api/completeTx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: address,
            txHash: spendTxHash,
            totalCreditSpend,
            totalKWhCharged,
          }),
        });

        // === 4️⃣ Update stats ===
        await fetch("/api/updateTotalCharge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: address,
            totalKWhCharged,
            totalCreditSpend,
          }),
        });

        setStatus("completed");
        if (onTxComplete) onTxComplete(spendTxHash);
        if (onStop) onStop();
      } catch (error: any) {
        toast.dismiss();
        console.error("Payment failed:", error);
        toast.error(error?.message || "Transaction failed");
        setStatus("idle");
      }
    }

    setProgress(0);
  };

  // --- CLEANUP ---
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // --- UI HELPERS ---
  const getButtonColor = () => {
    if (status === "completed") return "#f5f5f5";
    if (status === "processing") return "#9fffa1";
    return "#f3f4f6";
  };

  const getButtonText = () => {
    if (status === "completed") return "Transaction Completed";
    if (status === "processing") return "Processing Bolt Credit Transaction...";
    if (isHolding) return "Hold to stop...";
    return "Press and Hold to Stop Charging";
  };

  const isDisabled = status === "processing" || status === "completed";

  return (
    <div className="w-full flex justify-center mt-10 select-none touch-none px-4">
      <button
        disabled={isDisabled}
        onMouseDown={startHold}
        onMouseUp={() => stopHold()}
        onMouseLeave={() => stopHold()}
        onTouchStart={startHold}
        onTouchEnd={() => stopHold()}
        className={`relative w-full max-w-md py-6 rounded-2xl overflow-hidden font-medium transition-all duration-300 ${
          isDisabled ? "cursor-not-allowed" : "active:scale-95"
        }`}
        style={{ backgroundColor: getButtonColor() }}
      >
        {status === "idle" && (
          <div
            className="absolute top-0 left-0 h-full bg-[#00dd00] transition-none"
            style={{ width: `${progress * 100}%` }}
          />
        )}
        <span
          className="relative z-10 text-center w-full block transition-colors duration-200"
          style={{
            color:
              status === "processing" ||
              status === "completed" ||
              progress > 0.4
                ? "#ffffff"
                : "#374151",
          }}
        >
          {getButtonText()}
        </span>
      </button>
    </div>
  );
}
