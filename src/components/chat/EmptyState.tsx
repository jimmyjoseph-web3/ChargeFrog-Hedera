"use client";

import { Sparkle } from "lucide-react";
import type { DemoRole } from "@/components/chat/RolePill";

interface EmptyStateProps {
  role: DemoRole;
}

export function EmptyState({ role }: EmptyStateProps) {
  const isAdmin = role === "admin";

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black">
        <Sparkle className="h-12 w-12 fill-white text-white" />
      </div>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
        {isAdmin ? "Froggy Foundry" : "Froggy Chat"}
      </h1>

      <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-500 sm:text-base">
        {isAdmin
          ? "Automate on-chain investment proposal execution and ChargeFrog stations management on Hedera with ChargeFrog AI"
          : "Make your next ChargeFrog station investment planning and execution on Hedera with ChargeFrog AI"}
      </p>
    </div>
  );
}

export default EmptyState;