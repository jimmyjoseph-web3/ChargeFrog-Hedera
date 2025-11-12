"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useAccount } from "wagmi";
import { db } from "@/src/lib/firebaseClient";
import { ref, get } from "firebase/database";
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

  // Handle "Propose" click
  const handleProposeClick = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    const checkInvestor = new Promise<string>(async (resolve, reject) => {
      await new Promise((r) => setTimeout(r, 1000));
      if (userData?.isInvestor === true) resolve("You're a ChargeFrog investor");
      else reject("You're not a ChargeFrog investor");
    });

    toast.promise(checkInvestor, {
      loading: "Checking investor status...",
      success: (msg: string) => {
        setDrawerOpen(true);
        return msg;
      },
      error: (msg: string) => msg,
    });
  };

  return (
    <>
      {/* Floating propose button */}
      <motion.button
        onClick={() => setExpanded(!expanded)}
        className="relative flex items-center justify-center bg-white border-2 border-[#00ff00] text-black overflow-hidden mr-3"
        initial={false}
        animate={{
          width: expanded ? 230 : 55,
          borderRadius: 9999,
          transition: { type: "spring", stiffness: 250, damping: 20 },
        }}
        style={{ height: 55 }}
      >
        {/* Icon */}
        <motion.div
          animate={{
            scale: expanded ? 0.8 : 1,
            transition: { duration: 0.3 },
          }}
        >
          <Image
            src="/proposal/propose.png"
            alt="Propose"
            width={24}
            height={24}
            className="object-contain"
          />
        </motion.div>

        {/* Text (fade only) */}
        <AnimatePresence>
          {expanded && (
            <motion.span
              key="text"
              onClick={handleProposeClick}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="ml-2 font-semibold text-sm underline whitespace-nowrap cursor-pointer"
            >
              Propose a future location
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Drawer */}
      <ProposeLocationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
