"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import FloatingMenuBar from "@/src/components/floatingMenuBar";
import FloatingMenuBarBgCover from "@/src/components/floatingMenuBarBgCover";
import ProposalCard from "@/src/components/claim/proposalCard";
import ClaimSuccessDrawer from "@/src/components/claim/claimSuccessDrawer";
import ClaimNothingDrawer from "@/src/components/claim/claimNothingDrawer";
import { db } from "@/src/lib/firebaseClient";
import { ref, onValue, off, DataSnapshot } from "firebase/database";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { parseAbi, decodeEventLog } from "viem";

// ===== CONFIG =====
const STATION_ADDRESSES: Record<number, `0x${string}`> = {
  1: process.env.NEXT_PUBLIC_STATION_1 as `0x${string}`,
  2: process.env.NEXT_PUBLIC_STATION_2 as `0x${string}`,
  3: process.env.NEXT_PUBLIC_STATION_3 as `0x${string}`,
};

const STATION_ABI = parseAbi([
  "function claim() external",
  "event Claimed(uint256 indexed stationId, address indexed investor, uint256 claimedAmount)",
]);

const INITIAL_BUTTON_STATE = { text: "Check and claim", disabled: false };

// ===== TYPES =====
interface ProposalData {
  stationLocation: string;
  proposalNumber: number;
  latestPayoutDate: string;
  nextPayoutDate: string;
  numberOfTokenInvested: number;
  earningInHbar: number;
  buttonState: { text: string; disabled: boolean };
  onClick: () => void;
}

// ===== HELPERS =====
function formatLocalDMY(y: number, m: number, d: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d)}/${pad(m)}/${y}`;
}

// ===== COMPONENT =====
export default function Claim() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  if (!publicClient) {
    toast.error("Blockchain client not ready");
    return;
  }
  const { writeContractAsync } = useWriteContract();

  const [successDrawerOpen, setSuccessDrawerOpen] = useState(false);
  const [nothingDrawerOpen, setNothingDrawerOpen] = useState(false);
  const [proposals, setProposals] = useState<ProposalData[]>([]);
  const [claimedAmount, setClaimedAmount] = useState<number>(0);
  const [claimedTxHash, setClaimedTxHash] = useState<string>("");
  const [currentTxHash, setCurrentTxHash] = useState<string | undefined>(
    undefined
  );

  // Watch transaction receipt for the current txHash
  const { data: receipt, isSuccess } = useWaitForTransactionReceipt({
    hash: currentTxHash as `0x${string}`,
  });

  // ===== Fetch proposals from Firebase =====
  useEffect(() => {
    if (!address) return;

    const walletAddress = address.replace(/[.#$/[\]]/g, "_");
    const userInvestmentsRef = ref(db, `users/${walletAddress}/investments`);

    const listener = onValue(userInvestmentsRef, async (snapshot) => {
      if (!snapshot.exists()) {
        setProposals([]);
        return;
      }

      const investments = snapshot.val();
      const stationIds = Object.keys(investments);
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonthIndex = now.getMonth();
      const latestPayoutDate = formatLocalDMY(
        currentYear,
        currentMonthIndex + 1,
        1
      );
      const nextDate = new Date(currentYear, currentMonthIndex + 1, 1);
      const nextPayoutDate = formatLocalDMY(
        nextDate.getFullYear(),
        nextDate.getMonth() + 1,
        1
      );

      const fetchedProposals: ProposalData[] = await Promise.all(
        stationIds.map(async (stationId) => {
          const stationRef = ref(db, `stations/${stationId}`);
          return new Promise<ProposalData>((resolve) => {
            onValue(
              stationRef,
              (stationSnap) => {
                const stationData = stationSnap.val() || {};
                const investmentData = investments[stationId] || {};
                resolve({
                  stationLocation: stationData.stationName || "Unknown Station",
                  proposalNumber: Number(stationId),
                  latestPayoutDate,
                  nextPayoutDate,
                  numberOfTokenInvested: investmentData.investAmount ?? 0,
                  earningInHbar: investmentData.totalClaimed ?? 0,
                  buttonState: INITIAL_BUTTON_STATE,
                  onClick: () => handleClaimClick(Number(stationId)),
                });
              },
              { onlyOnce: true }
            );
          });
        })
      );

      setProposals(fetchedProposals);
    });

    return () => off(userInvestmentsRef, "value", listener);
  }, [address]);

  // ===== Effect: Process receipt when confirmed =====
  useEffect(() => {
    if (!receipt || !isSuccess) return;

    try {
      const claimedEvent = receipt.logs
        .map((log) => {
          try {
            return decodeEventLog({
              abi: STATION_ABI,
              data: log.data,
              topics: log.topics,
            });
          } catch {
            return null;
          }
        })
        .find((e) => e?.eventName === "Claimed");

      if (!claimedEvent) {
        setNothingDrawerOpen(true);
        toast.error("Nothing to claim at this time.");
        return;
      }

      const claimedAmt =
        Number((claimedEvent as any).args.claimedAmount) / 1e18;
      setClaimedAmount(claimedAmt);
      setClaimedTxHash(currentTxHash ?? "");
      setSuccessDrawerOpen(true);

      // Update Firebase
      fetch("/api/updateAfterClaim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          stationId: (claimedEvent as any).args.stationId,
          claimedAmount: claimedAmt,
        }),
      });

      toast.success(`Claimed ${claimedAmt.toFixed(2)} HBAR successfully!`);
    } catch (err) {
      console.error("Failed to process claim receipt", err);
    }
  }, [receipt, isSuccess]);

  // ===== Claim click handler =====
  const handleClaimClick = async (stationId: number) => {
    if (!address) return toast.error("Please connect your wallet first");

    const contractAddress = STATION_ADDRESSES[stationId];
    if (!contractAddress) return toast.error(`Unknown station ID ${stationId}`);

    try {
      toast.loading("Checking and claiming rewards...");

      // This will throw if the tx reverts
      const txHash = await writeContractAsync({
        address: contractAddress,
        abi: STATION_ABI,
        functionName: "claim",
        account: address,
      });

      // If it didn’t revert, wait for receipt
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      toast.dismiss();

      // Decode Claimed event
      const claimedEvent = receipt.logs
        .map((log) => {
          try {
            return decodeEventLog({
              abi: STATION_ABI,
              data: log.data,
              topics: log.topics,
            });
          } catch {
            return null;
          }
        })
        .find((e) => e?.eventName === "Claimed");

      if (!claimedEvent) {
        setNothingDrawerOpen(true);
        return toast.error("Nothing to claim at this time.");
      }

      const claimedAmt =
        Number((claimedEvent as any).args.claimedAmount) / 1e18;

      // Update Firebase
      await fetch("/api/updateAfterClaim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          stationId,
          claimedAmount: claimedAmt,
        }),
      });

      setClaimedAmount(claimedAmt);
      setClaimedTxHash(txHash);
      setSuccessDrawerOpen(true);
      toast.success(`Claimed ${claimedAmt.toFixed(2)} HBAR successfully!`);
    } catch (err: any) {
      toast.dismiss();
      console.error("Claim failed:", err);

      // Handle revert immediately
      if (err.message?.includes("NothingToClaim")) {
        setNothingDrawerOpen(true);
        toast.error("Nothing to claim yet.");
      } else {
        toast.error("Transaction failed or reverted.");
        setNothingDrawerOpen(true);
      }
    }
  };

  // ===== UI =====
  return (
    <div className="flex flex-col min-h-screen pb-[15vh]">
      <div className="flex-1 px-4 pt-8 pb-6 flex flex-col items-center text-center space-y-6">
        <h1 className="text-4xl font-medium">
          It&apos;s time to hop on <br />
          your <span className="text-[#00DD00]">earnings</span>!
        </h1>

        <p className="text-md text-gray-700">
          Claim your monthly payout rewards anytime <br />
          from your ChargeFrog station investments.
        </p>

        <div className="inline-flex items-center bg-white shadow-sm border border-gray-50 rounded-full px-4 py-2">
          <span className="text-lg font-semibold mr-2">{proposals.length}</span>
          <Image
            src="/claim/station.png"
            alt="Station Icon"
            width={24}
            height={24}
          />
        </div>

        {proposals.map((proposal) => (
          <ProposalCard key={proposal.proposalNumber} {...proposal} />
        ))}
      </div>

      <ClaimSuccessDrawer
        open={successDrawerOpen}
        onClose={() => setSuccessDrawerOpen(false)}
        txHash={claimedTxHash}
        hbarClaimed={claimedAmount}
      />

      <ClaimNothingDrawer
        open={nothingDrawerOpen}
        onClose={() => setNothingDrawerOpen(false)}
      />

      <FloatingMenuBar />
      <FloatingMenuBarBgCover />
    </div>
  );
}
