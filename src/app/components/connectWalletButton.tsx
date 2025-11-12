'use client';

import { useEffect, useState } from "react";
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { db } from "../lib/firebaseClient";
import { ref, get } from "firebase/database";
import { useRouter } from "next/navigation";

export default function ConnectWalletButton() {
  const router = useRouter();
  const { openConnectModal } = useConnectModal();
  const { address, isConnected } = useAccount();
  const [isProcessing, setIsProcessing] = useState(false);

  // Checks if user exists in Firebase, registers if missing
  const handleUserCheck = async (walletAddress: string) => {
    try {
      const userRef = ref(db, `users/${walletAddress}`);
      const snapshot = await get(userRef);

      if (!snapshot.exists()) {
        await fetch("/api/registerUser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress }),
        });
      }
    } catch (error) {
      console.error("Failed to check or register user:", error);
    }
  };

  // Auto-check on eager connect
  useEffect(() => {
    const checkUser = async () => {
      if (isConnected && address) {
        setIsProcessing(true);
        await handleUserCheck(address);
        setIsProcessing(false);
        router.push("/map");
      }
    };
    checkUser();
  }, [isConnected, address, router]);

  return (
    <div className="fixed inset-x-0 bottom-[1rem] z-[100] flex flex-col items-center px-4">
      <button
        onClick={openConnectModal}
        disabled={isProcessing || isConnected}
        className={`
          w-full max-w-md text-xl font-medium rounded-lg px-6 py-4 transition-colors
          ${isProcessing || isConnected
            ? "bg-gray-400 text-gray-700 cursor-not-allowed"
            : "bg-black text-white hover:bg-gray-900"}
        `}
      >
        {isProcessing
          ? "Processing..."
          : isConnected
          ? "Wallet Connected"
          : "Connect Wallet"}
      </button>

      <p className="mt-3 text-sm text-gray-500 text-center">Powered by RainbowKit</p>
    </div>
  );
}
