"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Drawer, DrawerContent } from "@/src/components/ui/drawer";
import DrawerButton from "../drawerButton";
import toast from "react-hot-toast";

type ProposeLocationDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export default function ProposeLocationDrawer({
  open,
  onClose,
}: ProposeLocationDrawerProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isAutoFillRef = useRef(false);

  // Reset state when drawer opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setSuggestions([]);
    }
  }, [open]);

  // Fetch suggestions
  useEffect(() => {
    if (isAutoFillRef.current) {
      isAutoFillRef.current = false;
      return;
    }

    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/autocomplete?text=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        setSuggestions(data.results.slice(0, 3));
      } catch (err) {
        console.error("Autocomplete failed:", err);
        setSuggestions([]);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectSuggestion = (s: string) => {
    isAutoFillRef.current = true;
    setQuery(s);
    setSuggestions([]);
    inputRef.current?.blur();
  };

  const handleClearInput = () => {
    setQuery("");
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (!query.trim()) {
      toast.error("Please enter a location");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/proposedLocation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposedLocation: query }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to submit");

      toast.success("Location submitted successfully!");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while submitting");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent className="w-full max-w-full border-none bg-white">
        <div className="mx-auto w-full max-w-md px-4 pt-6 pb-8 text-center flex flex-col gap-8">
          
          {/* Input Area — now at the top */}
          <div className="relative w-full">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search or enter the location"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-5 pr-10 focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            {/* Clear (X) */}
            {query && (
              <button
                type="button"
                onClick={handleClearInput}
                className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 cursor-pointer text-lg"
              >
                ×
              </button>
            )}

            {/* Suggestions Dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-md z-10 text-left max-h-[40vh] overflow-y-auto">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="flex items-center justify-start gap-2 px-4 py-4 hover:bg-gray-50 w-full text-sm text-gray-800 text-left"
                    onClick={() => handleSelectSuggestion(s)}
                  >
                    <Image
                      src="/proposal/pin.png"
                      alt="Location"
                      width={18}
                      height={18}
                    />
                    <span className="text-left break-words">{s}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Illustration + Text — now below */}
          <div>
            <Image
              src="/proposal/frog-with-map.png"
              alt="Frog with Map"
              width={140}
              height={140}
              className="mx-auto mb-4"
            />

            <h2 className="text-[1.8rem] font-semibold text-gray-900 mb-2">
              Where&apos; next?
            </h2>

            <p className="text-md text-gray-700 leading-relaxed px-2">
              As one of the ChargeFrog station investors holding our token
              shares, you are eligible to propose a location for the next round!
            </p>
          </div>

          {/* Submit Button */}
          <div className="mt-4">
            <div
              className={`relative ${
                isSubmitting ? "opacity-60 pointer-events-none" : ""
              }`}
            >
              <DrawerButton
                text={isSubmitting ? "Submitting..." : "Submit location"}
                onClick={handleSubmit}
              />
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
