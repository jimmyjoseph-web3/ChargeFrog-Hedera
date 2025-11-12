"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import Image from "next/image";

export default function WalletGuard({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkWallet = () => {
      // Skip wallet check on root (connect) page
      if (pathname === "/") {
        setIsChecking(false);
        return;
      }

      // Redirect to root if not connected
      if (!isConnected) {
        router.push("/");
      }

      setIsChecking(false);
    };

    checkWallet();
  }, [isConnected, pathname, router]);

  // Prevent child rendering until check completes
  if (isChecking) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-[9999]">
        <Image
          src="/route-checking.gif"
          alt="Checking wallet connection..."
          width={180}
          height={180}
          priority
        />
      </div>
    );
  }

  return <>{children}</>;
}
