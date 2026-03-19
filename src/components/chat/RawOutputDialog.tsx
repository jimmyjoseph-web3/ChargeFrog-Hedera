"use client";

import { ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RawOutputDialogProps {
  rawOutput: Record<string, unknown>;
}

export default function RawOutputDialog({ rawOutput }: RawOutputDialogProps) {
  const formatted = JSON.stringify(rawOutput, null, 2);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200"
        >
          <ChevronRight className="h-3.5 w-3.5" />
          <span>Raw Output</span>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Raw Output</DialogTitle>
        </DialogHeader>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950">
          <ScrollArea className="h-[65vh] w-full">
            <pre className="p-4 text-xs leading-6 text-zinc-100">
              <code>{formatted}</code>
            </pre>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}