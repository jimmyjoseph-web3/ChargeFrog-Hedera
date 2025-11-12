"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Drawer, DrawerContent } from "@/src/components/ui/drawer";
import DrawerButton from "../drawerButton";
import { ref, onValue, off, DataSnapshot } from "firebase/database";
import { db } from "@/src/lib/firebaseClient";

type PlugInPortDrawerProps = {
  open: boolean;
  onClose: () => void;
  stationData: {
    id: string;
    stationName: string;
    proposalId: string;
    type: string;
    kW: string | number;
    acdc: string;
  };
  portBayNumber: number;
  drawerButton: {
    text: string;
    onClick: () => void;
  };
  userWallet: string;
};

export default function PlugInPortDrawer({
  open,
  onClose,
  stationData,
  portBayNumber,
  drawerButton,
  userWallet,
}: PlugInPortDrawerProps) {
  const [dots, setDots] = useState(".");
  const [isConnected, setIsConnected] = useState(false);

  // Animate dots
  useEffect(() => {
    if (!open || isConnected) return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length === 3 ? "." : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [open, isConnected]);

  // Listen to isConnected
  useEffect(() => {
    if (!open) return;

    const pendingRef = ref(db, `users/${userWallet}/pendingCharge/isConnected`);
    const listener = (snapshot: DataSnapshot) => {
      setIsConnected(snapshot.exists() && snapshot.val() === true);
    };

    onValue(pendingRef, listener);
    return () => off(pendingRef, "value", listener);
  }, [open, userWallet]);

  // Log on open
  useEffect(() => {
    if (open) {
      console.log(
        `User pending on port ${portBayNumber} of station ID: ${stationData.id}`
      );
    }
  }, [open, portBayNumber, stationData.id]);

  const handleClose = () => {
    console.log(
      `User cancel connecting to port ${portBayNumber} of station ID: ${stationData.id}`
    );
    onClose();
  };

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="w-full max-w-full px-4 border-none bg-white">
        <div className="mx-auto w-full max-w-md text-center pt-10">
          {/* Station Label */}
          <p className="text-sm text-gray-500 mb-4">
            ChargeFrog Station #{stationData.proposalId}
          </p>

          {/* Station Name */}
          <h2 className="text-[2rem] font-medium text-gray-900 mb-5">
            {stationData.stationName}
          </h2>

          {/* Type / Power Info Pill */}
          {(stationData.type || stationData.kW || stationData.acdc) && (
            <div className="inline-block bg-gray-100 text-gray-700 text-sm font-bold px-5 py-3 rounded-full mb-6">
              {stationData.type ? `${stationData.type} : ` : ""}
              {stationData.kW ? `${stationData.kW}kW ` : ""}
              {stationData.acdc ? stationData.acdc : ""}
            </div>
          )}

          {/* Plug-in Illustration */}
          <div className="mx-auto mb-3 w-[220px] h-[220px] relative">
            <Image
              src="/station/plug-in.png"
              alt="Plug In Illustration"
              width={220}
              height={220}
              className="mx-auto"
            />
          </div>

          {/* Subtitle or Connected Tick */}
          {!isConnected ? (
            <>
              <h2 className="text-xl text-black font-medium mb-2">
                Plug in the connectors
              </h2>
              <p className="text-6xl text-[#00dd00] font-black tracking-widest mb-10 -m-6">
                {dots}
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center mt-4 mb-10">
              <Image
                src="/station/connected.png"
                alt="Connected Tick"
                width={40}
                height={40}
              />
            </div>
          )}

          {/* Dynamic Button */}
          <DrawerButton text={drawerButton.text} onClick={drawerButton.onClick} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
