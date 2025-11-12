"use client"

import Image from "next/image";
import FloatingMenuBar from "@/src/components/floatingMenuBar";
import StickyPageButton from "@/src/components/stickyPageButton";
import { useRouter } from "next/navigation";

export default function CreditPage() {

  const router = useRouter();

  const handleClick = () => {
    router.push("/swap");
  }

  return (
    <>
      <main className="h-screen overflow-hidden text-center relative">
        {/* Fixed illustration + title + description */}
        <div
          className="
            fixed inset-x-0 
            bottom-[calc(15vh+9rem)] 
            z-[900] flex flex-col items-center justify-center px-4
          "
        >
          {/* Illustration */}
          <Image
            src="/credit/floating-bolt-credit.png"
            alt="Floating Bolt Credit"
            width={300}
            height={300}
            className="mx-auto"
            priority
          />

          {/* Title */}
          <h1 className="mt-6 text-4xl md:text-5xl font-medium leading-snug">
            <span className="block">Hop into charge</span>
            <span className="block">
              mode with <span className="text-[#00DD00]">Bolt credits</span>
            </span>
          </h1>

          {/* Description */}
          <p className="mt-7 text-md md:text-xl text-gray-700 max-w-md">
            Swap your HBAR for BOLT easily and start <br /> charging your EV at
            any ChargeFrog stations.
          </p>
        </div>

        {/* Sticky Button above menu bar */}
        <div className="fixed inset-x-0 bottom-[calc(15vh+1.5rem)] z-[950] flex justify-center px-4">
          <StickyPageButton text="Get $BOLT" onClick={handleClick}/>
        </div>

        {/* Floating Menu Bar */}
        <FloatingMenuBar />
      </main>
    </>
  );
}
