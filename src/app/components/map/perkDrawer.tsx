"use client";

import Image from "next/image";
import { Drawer, DrawerContent } from "../ui/drawer";
import DrawerButton from "../drawerButton";

type PerkDrawerProps = {
  open: boolean;
  onClose: () => void;
  recentInvestStation: string;
};

export default function PerkDrawer({ open, onClose, recentInvestStation }: PerkDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent className="w-full max-w-full px-4 border-none bg-white">
        <div className="mx-auto w-full max-w-md text-center">
          {/* Illustration */}
          <Image
            src="/station/perk.png"
            alt="Perk Illustration"
            width={230}
            height={230}
            className="mx-auto mt-8 mb-5"
          />

          {/* Title */}
          <h2 className="text-[2.2rem] font-medium text-gray-900 mb-2">
            Special perk for you!
          </h2>

          {/* Subtitle with icon */}
          <div className="flex items-center justify-center gap-1 mb-8 mt-3">
            <Image
              src="/station/discount-tag.png"
              alt="Discount Tag"
              width={30}
              height={30}
              className="object-contain"
            />
            <span className="text-black font-semibold text-xl">10% Discount Rate</span>
          </div>

          {/* Description */}
          <p
            className="text-md text-gray-700 leading-relaxed mb-5"
            dangerouslySetInnerHTML={{
              __html: "Every frogvestor at ChargeFrog will sure <br/> get a sweeter deal at every charge.",
            }}
          />

          {/* Pill */}
          <div className="mt-10 flex items-center justify-center gap-2 border border-gray-200 rounded-full py-4 px-4 bg-white">
            <div className="flex flex-col items-center gap-1">
              <span className="text-gray-400 text-sm">Recent invest in</span>
              <span className="text-black text-lg font-medium">{recentInvestStation}</span>
            </div>
          </div>

          {/* Close Button */}
          <div className="mt-10 w-full">
            <DrawerButton text="Continue charging" onClick={onClose} />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
