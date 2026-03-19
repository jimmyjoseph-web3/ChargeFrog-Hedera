"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WalletConnectionPillProps {
  address: string;
  onAddressChange: (address: string) => void;
}

function formatWalletAddress(address: string) {
  const cleaned = address.trim();
  if (!cleaned) return "0.0.00000";
  if (cleaned.length <= 10) return cleaned;
  return `${cleaned.slice(0, 5)}...${cleaned.slice(-5)}`;
}

export function WalletConnectionPill({
  address,
  onAddressChange,
}: WalletConnectionPillProps) {
  const [draft, setDraft] = useState(address);

  useEffect(() => {
    setDraft(address);
  }, [address]);

  const displayAddress = useMemo(() => formatWalletAddress(address), [address]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          <div className="relative h-6 w-6 shrink-0">
            <Image
              src="/hedera.png"
              alt="Hedera"
              fill
              className="object-contain"
            />
          </div>
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="truncate">{displayAddress}</span>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wallet Address</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wallet-address">Displayed address</Label>
            <Input
              id="wallet-address"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="0.0.1234567890"
            />
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-xs text-zinc-500">Preview</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">
              {formatWalletAddress(draft)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onAddressChange(draft.trim())}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Save address
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WalletConnectionPill;