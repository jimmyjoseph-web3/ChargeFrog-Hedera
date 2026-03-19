"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useAccount } from "wagmi";
import { db } from "@/src/lib/firebaseClient";
import { ref, get } from "firebase/database";
import { Sparkle } from "lucide-react";

import ProposeLocationDrawer from "./proposeLocationDrawer";

export default function ProposeLocationButton() {
  const [expanded, setExpanded] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { address, isConnected } = useAccount();

  useEffect(() => {
    if (!isConnected || !address) return;

    const fetchUserData = async () => {
      try {
        const walletKey = address.replace(/[.#$/[\]]/g, "_");
        const userRef = ref(db, `users/${walletKey}`);
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
  }, [isConnected, address]);

  const handleClick = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    const checkInvestor = new Promise<string>(async (resolve, reject) => {
      await new Promise((r) => setTimeout(r, 800));
      if (userData?.isInvestor === true) resolve("You're a ChargeFrog investor");
      else reject("You're not a ChargeFrog investor");
    });

    toast.promise(checkInvestor, {
      loading: "Checking investor status...",
      success: () => {
        setDrawerOpen(true);
        return "Access granted";
      },
      error: (msg: string) => msg,
    });
  };

  return (
    <>
      <motion.button
        onClick={() => setExpanded(!expanded)}
        className="relative flex items-center justify-center bg-white border border-black text-black overflow-hidden mr-3"
        initial={false}
        animate={{
          width: expanded ? 290 : 60,
          borderRadius: 9999,
          transition: { type: "spring", stiffness: 260, damping: 22 },
        }}
        style={{ height: 60 }}
      >
        {/* Icon */}
        <motion.div
          animate={{ scale: expanded ? 0.9 : 1 }}
          transition={{ duration: 0.25 }}
          className="flex items-center justify-center"
        >
          <Sparkle className="w-6 h-6 fill-black text-black" />
        </motion.div>

        {/* Expanded Content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              key="content"
              onClick={handleClick}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="ml-3 flex items-center gap-3 cursor-pointer whitespace-nowrap"
            >
              <span className="text-base font-semibold underline">
                Enter Froggy Chat
              </span>

              {/* AI Badge */}
              <span className="px-3 py-[3px] text-xs font-semibold rounded-md bg-black text-white">
                AI
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      <ProposeLocationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}