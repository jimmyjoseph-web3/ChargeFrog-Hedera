"use client";

import { useEffect, useState } from "react";
import { ref, onValue, off, DataSnapshot } from "firebase/database";
import { db } from "../lib/firebaseClient";

type PageButtonProps = {
  text: string;
  onClick?: () => void;
  walletAddress: string;
};

export default function PageButton({ text, onClick, walletAddress }: PageButtonProps) {
  const [hasActiveCharge, setHasActiveCharge] = useState(false);

  useEffect(() => {
    if (!walletAddress) return;

    const activeChargeRef = ref(db, `users/${walletAddress}/activeCharge`);

    const listener = (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      setHasActiveCharge(!!data);
    };

    onValue(activeChargeRef, listener);
    return () => off(activeChargeRef, "value", listener);
  }, [walletAddress]);

  return (
    <div className="w-full flex justify-center py-4 pb-35">
      <button
        onClick={hasActiveCharge ? undefined : onClick}
        disabled={hasActiveCharge}
        className={`
          w-full font-medium text-lg rounded-2xl py-4 px-6 shadow-md transition-colors
          ${hasActiveCharge
            ? "bg-gray-200 text-gray-600 cursor-not-allowed"
            : "bg-black text-white hover:bg-gray-900"
          }
        `}
      >
        {hasActiveCharge ? "You are still charging..." : text}
      </button>
    </div>
  );
}
