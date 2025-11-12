"use client";

import Image from "next/image";
import { Drawer, DrawerContent } from "@/src/components/ui/drawer";
import DrawerButton from "../drawerButton";

type ClaimNothingDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export default function ClaimNothingDrawer({ open, onClose }: ClaimNothingDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent className="w-full max-w-full px-4 border-none bg-white">
        <div className="mx-auto w-full max-w-md text-center">
          {/* Illustration */}
          <Image
            src="/claim/claimedNothing.png"
            alt="Nothing to Claim Illustration"
            width={200}
            height={200}
            className="mx-auto m-10"
          />

          {/* Title */}
          <h2 className="text-[2.2rem] font-medium text-gray-900 mb-5">
            Nothing to claim!
          </h2>

          {/* Description */}
          <p
            className="text-md text-gray-700 leading-relaxed mb-5"
            dangerouslySetInnerHTML={{
              __html:
                "Your monthly payout for your ChargeFrog <br/> investment had claimed completely.<br/><br/>Come again next month!",
            }}
          />

          {/* Close Button */}
          <div className="mt-10 w-full">
            <DrawerButton text="Back to investments" onClick={onClose} />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
