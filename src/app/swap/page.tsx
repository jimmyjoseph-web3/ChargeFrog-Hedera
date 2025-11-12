"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import FloatingMenuBar from "@/src/components/floatingMenuBar";
import StickyPageButton from "@/src/components/stickyPageButton";
import SwapSuccessDrawer from "@/src/components/swap/drawer";
import toast from "react-hot-toast";

import { db } from "@/src/lib/firebaseClient";
import { ref, get, set } from "firebase/database";

import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther } from "viem";

import {
  convertHbarToBolt,
  HBAR_TO_BOLT_RATE,
} from "@/src/utils/hbarToBoltConversion";

const BOLT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_BOLT as `0x${string}`;

if (!BOLT_CONTRACT_ADDRESS) {
  throw new Error("BOLT contract address is not set in env");
}

const BOLT_ABI = [
  {
    name: "buyBolt",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export default function Swap() {
  const [hbarAmount, setHbarAmount] = useState<string>("");
  const [boltAmount, setBoltAmount] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);

  const { address: userAddress, isConnected } = useAccount();

  const { writeContractAsync } = useWriteContract();
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess,
  } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}`,
  });

  // === Convert Input ===
  const handleHbarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^\d.]/g, "");
    setHbarAmount(rawValue);

    const numericValue = parseFloat(rawValue);
    if (!isNaN(numericValue)) {
      const converted = convertHbarToBolt(numericValue);
      setBoltAmount(converted.toLocaleString("en-US"));
    } else {
      setBoltAmount("");
    }
  };

  const formattedHbar = hbarAmount
    ? parseFloat(hbarAmount).toLocaleString("en-US")
    : "";

  // === Buy BOLT Logic ===
  const handlePurchase = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }

    const numeric = parseFloat(hbarAmount);
    if (!numeric || numeric <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setIsPending(true);

    try {
      toast.loading("Purchasing BOLT...");

      const tx = await writeContractAsync({
        address: BOLT_CONTRACT_ADDRESS,
        abi: BOLT_ABI,
        functionName: "buyBolt",
        value: parseEther(numeric.toString()), // 18 decimals
      });

      setTxHash(tx); // triggers useWaitForTransactionReceipt
      toast.success("Transaction sent!");
    } catch (err: any) {
      console.error("Buy failed:", err);
      toast.dismiss();
      toast.error(err.message || "Purchase failed");
    } finally {
      setIsPending(false);
    }
  };

  // === React to confirmation ===
  useEffect(() => {
    if (isSuccess && receipt) {
      toast.dismiss();
      toast.success("Purchase confirmed!", { duration: 5000 });

      const boltValue = boltAmount
        ? parseInt(boltAmount.replace(/,/g, ""), 10)
        : 0;

      if (userAddress) {
        const userRef = ref(db, `users/${userAddress}/boltCreditAmount`);
        get(userRef).then((snapshot) => {
          const current = snapshot.exists() ? snapshot.val() : 0;
          set(userRef, current + boltValue);
        });
      }

      setOpen(true);
    }
  }, [isSuccess, receipt, boltAmount, userAddress]);

  return (
    <main className="h-screen overflow-hidden text-center relative bg-white">
      <div
        className="
          fixed inset-x-0
          bottom-[calc(15vh+9rem)]
          z-[900]
          flex flex-col items-center justify-center
          px-4
        "
      >
        {/* You pay */}
        <div className="relative w-full max-w-md border border-gray-200 rounded-xl p-4 text-left">
          <p className="text-sm text-gray-500 mb-2">You pay</p>
          <input
            type="text"
            inputMode="decimal"
            value={formattedHbar}
            onChange={handleHbarChange}
            placeholder="0"
            className="w-full text-4xl font-bold text-black bg-transparent outline-none"
          />
          <div className="absolute bottom-4 right-4 flex items-center gap-2">
            <Image
              src="/credit/hbar.png"
              alt="HBAR"
              width={32}
              height={32}
              className="object-contain"
            />
            <span className="text-2xl font-medium">HBAR</span>
          </div>
        </div>

        {/* Swap icon */}
        <div className="relative -my-4 z-10">
          <Image
            src="/credit/swap.png"
            alt="Swap Icon"
            width={48}
            height={48}
            className="mx-auto bg-white rounded-full"
          />
        </div>

        {/* You receive */}
        <div className="relative w-full max-w-md border border-gray-200 rounded-xl p-4 text-left">
          <p className="text-sm text-gray-500 mb-2">You receive</p>
          <input
            type="text"
            value={boltAmount}
            placeholder="0"
            readOnly
            className="w-full text-4xl font-bold text-[#00dd00] bg-transparent outline-none"
          />
          <div className="absolute bottom-4 right-4 flex items-center gap-2">
            <Image
              src="/credit/bolt-credit.png"
              alt="BOLT"
              width={32}
              height={32}
              className="object-contain"
            />
            <span className="text-2xl font-medium text-[#00dd00]">BOLT</span>
          </div>
        </div>

        {/* Conversion pill */}
        <div className="mt-10 border border-gray-100 shadow-sm rounded-full px-6 py-3 bg-white">
          <p className="text-md font-medium text-gray-800">
            1 HBAR = {HBAR_TO_BOLT_RATE} BOLT
          </p>
        </div>

        {/* Note */}
        <div className="mt-8 text-gray-700 text-sm font-light leading-snug">
          <span>
            This swap only accepts whole tokens.
            <br />
            Fractions are not supported.
          </span>
        </div>
      </div>

      <StickyPageButton
        text={isPending || isConfirming ? "Processing..." : "Purchase $BOLT"}
        onClick={isPending || isConfirming ? undefined : handlePurchase}
      />

      <FloatingMenuBar />

      <SwapSuccessDrawer
        open={open}
        onClose={() => setOpen(false)}
        txHash={txHash as `0x${string}`}
        hbarAmount={hbarAmount ? parseFloat(hbarAmount) : 0}
        boltAmount={boltAmount ? parseInt(boltAmount.replace(/,/g, "")) : 0}
      />
    </main>
  );
}
