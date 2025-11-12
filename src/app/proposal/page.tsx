"use client";

import Image from "next/image";
import FloatingMenuBar from "@/src/components/floatingMenuBar";
import FloatingMenuBarBgCover from "@/src/components/floatingMenuBarBgCover";
import ProposalCard from "@/src/components/proposal/proposalCard";
import ProposeLocationButton from "@/src/components/proposal/proposeLocationButton";
import { useRouter } from "next/navigation";

export default function Proposal() {
  const router = useRouter();

  return (
    <>
      <FloatingMenuBar />
      <FloatingMenuBarBgCover />

      <div className="flex flex-col items-center justify-center min-h-screen bg-white px-2">
        {/* --- Top section with Propose button above title --- */}
        <div className="flex flex-col items-center w-full max-w-md text-center space-y-5 mt-6">
          {/* Button aligned to the right */}
          <div className="w-full flex justify-end pr-2">
            <ProposeLocationButton />
          </div>

          {/* Title */}
          <h1 className="text-[1.7rem] font-medium leading-snug">
            Own a Piece of Every Charge <br />
            with{" "}
            <span className="text-[#00dd00] font-medium">
              ChargeFrog Invest
            </span>
          </h1>

          {/* Illustration */}
          <Image
            src="/proposal/charging-frog.png"
            alt="Charging Frog Illustration"
            width={300}
            height={300}
            className="mx-auto mt-3 mb-3"
          />

          {/* Description */}
          <p className="text-gray-700 text-md leading-relaxed">
            Fractional ownership of EV charging infrastructure <br />
            made possible with asset tokenization on IOTA.
          </p>

          {/* Past Rounds Box */}
          <div
            onClick={() => router.push("/proposal/completed")}
            className="border border-gray-200 bg-white rounded-lg px-8 py-4 shadow-sm flex items-center justify-center gap-2 hover:shadow-md transition-all cursor-pointer"
          >
            <span className="underline text-black font-medium">
              Our successful past rounds
            </span>
            <Image
              src="/proposal/link-arrow.png"
              alt="Link Arrow"
              width={25}
              height={25}
            />
          </div>
        </div>

        {/* Proposal Card */}
        <div className="w-full mt-12 mb-35 px-4 sm:px-10">
          <ProposalCard />
        </div>
      </div>
    </>
  );
}
