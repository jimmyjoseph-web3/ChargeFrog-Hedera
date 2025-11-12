"use client";

import Image from "next/image";
import Link from "next/link";
import { Drawer, DrawerContent } from "@/src/components/ui/drawer";
import DrawerButton from "../drawerButton";

function shortenTxHash(hash: string): string {
  if (!hash || hash.length <= 10) return hash;
  return `${hash.slice(0, 5)}...${hash.slice(-5)}`;
}

type ClaimSuccessDrawerProps = {
  open: boolean;
  onClose: () => void;
  txHash: string;
  hbarClaimed: number;
};

export default function ClaimSuccessDrawer({
  open,
  onClose,
  txHash,
  hbarClaimed,
}: ClaimSuccessDrawerProps) {
  const shortened = shortenTxHash(txHash);
  const txUrl = `https://hashscan.io/testnet/transaction/${txHash}`;

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent className="w-full max-w-full px-4 border-none bg-white">
        <div className="mx-auto w-full max-w-md text-center">
          {/* Illustration */}
          <Image
            src="/claim/claimed.png"
            alt="Claimed Illustration"
            width={150}
            height={150}
            className="mx-auto mt-8 mb-5"
          />

          {/* Title */}
          <h2 className="text-[2.2rem] font-medium text-gray-900 mb-5">
            Claimed!
          </h2>

          {/* Description */}
          <p
            className="text-md text-gray-700 leading-relaxed mb-5"
            dangerouslySetInnerHTML={{
              __html:
                "Your monthly payout for your ChargeFrog <br/> investment had transferred to your wallet.",
            }}
          />

          {/* Transaction Hash Link */}
          <Link
            href={txUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-gray-700 underline text-lg mt-4"
          >
            {shortened}
          </Link>

          {/* Hedera Claim Pill */}
          <div className="mt-10 flex items-center justify-center gap-2 border border-gray-200 rounded-full py-4 px-2 bg-white">
            <div className="flex items-center gap-2">
              <Image
                src="/claim/hbar.png"
                alt="hbar"
                width={28}
                height={28}
                className="object-contain"
              />
              <span className="text-gray-800 font-bold text-md">
                {hbarClaimed.toLocaleString()} HBAR earning claimed
              </span>
            </div>
          </div>

          {/* Close Button */}
          <div className="mt-10 w-full">
            <DrawerButton text="Back to investments" onClick={onClose} />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
