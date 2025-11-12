"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

export default function InfoBox() {
  const [expanded, setExpanded] = useState(false);
  const [showText, setShowText] = useState(false);

  // handle delayed text reveal
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (expanded) {
      timer = setTimeout(() => setShowText(true), 250); // delay text by 250ms
    } else {
      setShowText(false);
    }
    return () => clearTimeout(timer);
  }, [expanded]);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className={`fixed top-4 left-4 z-[5] bg-gray-100 rounded-2xl shadow-md cursor-pointer overflow-hidden transition-all duration-300 ease-in-out flex items-center ${
        expanded
          ? "w-[calc(100%-2rem)] h-[80px] px-4"
          : "w-[60px] h-[60px] justify-center"
      }`}
    >
      {/* Icon */}
      <Image
        src="/charging/info.png"
        alt="Info"
        width={28}
        height={28}
        className={`transition-all duration-300 ${expanded ? "mr-3" : ""}`}
      />

      {/* Text fades in after expansion */}
      {expanded && (
        <p
          className={`text-gray-700 text-sm leading-snug transition-opacity duration-300 ${
            showText ? "opacity-100" : "opacity-0"
          }`}
        >
          Feel free to navigate to other sections! You can <br />
          check back your active charging at the “Map”.
        </p>
      )}
    </div>
  );
}
