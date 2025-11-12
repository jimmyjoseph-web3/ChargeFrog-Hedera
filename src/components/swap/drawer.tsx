  "use client";

  import Image from "next/image";
  import Link from "next/link";
  import { useRouter } from "next/navigation";
  import { Drawer, DrawerContent } from "@/src/components/ui/drawer";
  import DrawerButton from "../drawerButton";

  function shortenTxHash(hash: string): string {
    if (!hash || hash.length <= 10) return hash;
    return `${hash.slice(0, 5)}...${hash.slice(-5)}`;
  }

  type SwapSuccessDrawerProps = {
    open: boolean;
    onClose: () => void;
    txHash: `0x${string}`;
    hbarAmount: number;
    boltAmount: number;
  };

  export default function SwapSuccessDrawer({
    open,
    onClose,
    txHash,
    hbarAmount,
    boltAmount,
  }: SwapSuccessDrawerProps) {
    const router = useRouter();
    const shortened = shortenTxHash(txHash);
    const txUrl = `https://hashscan.io/testnet/transaction/${txHash}`;

    const handleStartCharging = () => {
      onClose(); 
      router.push("/map");
    };

    return (
      <Drawer open={open} onOpenChange={onClose}>
        <DrawerContent className="w-full max-w-full px-4 border-none bg-white">
          <div className="mx-auto w-full max-w-md text-center">
            {/* Illustration */}
            <Image
              src="/credit/bolt-credit.png"
              alt="Success Illustration"
              width={150}
              height={150}
              className="mx-auto m-10"
            />

            {/* Title */}
            <h2 className="text-[2.2rem] font-medium text-gray-900 mb-5">
              Purchase success!
            </h2>

            {/* 💬 Description */}
            <p
              className="text-md text-gray-700 leading-relaxed mb-5"
              dangerouslySetInnerHTML={{
                __html:
                  "You&apos;re now ready to jump on your <br/> charging journey with ChargeFrog.",
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

            <div className="mt-10 flex items-center justify-center gap-2 border border-gray-200 rounded-full py-4 px-2 bg-white">
              <div className="flex items-center gap-2">
                <Image
                  src="/credit/hbar.png"
                  alt="hbar"
                  width={28}
                  height={28}
                  className="object-contain"
                />
                <span className="text-gray-800 font-bold text-md">
                  {hbarAmount.toLocaleString()} hbar
                </span>
              </div>

              <Image
                src="/credit/swap-black.png"
                alt="Swap"
                width={24}
                height={24}
                className="object-contain mx-2"
              />

              <div className="flex items-center gap-2">
                <Image
                  src="/credit/bolt-credit.png"
                  alt="BOLT"
                  width={28}
                  height={28}
                  className="object-contain"
                />
                <span className="text-gray-800 font-bold">
                  {boltAmount.toLocaleString()} BOLT
                </span>
              </div>
            </div>

            {/* Close Button */}
            <div className="mt-10 w-full">
              <DrawerButton text="Start Charging" onClick={handleStartCharging} />
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }
