"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Drawer, DrawerContent } from "@/src/components/ui/drawer";
import DrawerButton from "../drawerButton";

function shortenHash(hash: string): string {
  if (!hash || hash.length <= 10) return hash;
  return `${hash.slice(0, 5)}...${hash.slice(-5)}`;
}

type InvestmentSuccessDrawerProps = {
  open: boolean;
  onClose: () => void;
  txHash: string;
  amountOfHBARInvested: number;
};

export default function InvestmentSuccessDrawer({
  open,
  onClose,
  txHash,
  amountOfHBARInvested,
}: InvestmentSuccessDrawerProps) {
  const router = useRouter();
  const shortened = shortenHash(txHash);
  const shareTokens = amountOfHBARInvested; // 1:1 conversion

  const handleClose = () => {
    onClose();
    router.push("/proposal");
  };

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="w-full max-w-full px-4 border-none bg-white">
        <div className="mx-auto w-full max-w-md text-center">
          {/* Illustration */}
          <Image
            src="/proposal/investment-success.png"
            alt="Investment Success"
            width={200}
            height={200}
            className="mx-auto mt-8 mb-5"
          />

          {/* Title */}
          <h2 className="text-[2.2rem] font-medium text-gray-900 mb-5">
            Investment Success!
          </h2>

          {/* Description */}
          <p
            className="text-md text-gray-700 leading-relaxed mb-5"
            dangerouslySetInnerHTML={{
              __html:
                "Welcome to the ChargeFrog swarm! <br/> You now own a piece of the charging future.",
            }}
          />

          {/* Transaction Hash Link */}
          <a
            href={`https://hashscan.io/testnet/transaction/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-gray-700 underline text-lg mt-4 block"
          >
            {shortened}
          </a>

          {/* HBAR + Share Tokens Pill */}
          <div className="mt-10 flex items-center justify-center gap-2 border border-gray-200 rounded-full py-4 px-4 bg-white">
            <div className="flex items-center gap-2">
              <Image
                src="/proposal/hbar.png"
                alt="HBAR"
                width={25}
                height={25}
                className="object-contain"
              />
              <span className="text-gray-800 font-bold text-md">
                {amountOfHBARInvested.toLocaleString()} HBAR
              </span>
              <Image
                src="/proposal/swap-black.png"
                alt="Swap"
                width={30}
                height={30}
                className="object-contain mx-3"
              />
              <span className="text-gray-800 font-bold text-md">
                {shareTokens.toLocaleString()} share tokens
              </span>
            </div>
          </div>

          {/* Drawer Button */}
          <div className="mt-10 w-full">
            <DrawerButton text="Check your investments" onClick={handleClose} />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
