"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import React from "react";

interface StationRenderTemplateProps {
  bannerImageUrl?: string;
  children: React.ReactNode;
}

export default function StationRenderTemplate({
  bannerImageUrl,
  children,
}: StationRenderTemplateProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 70);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const resolvedBanner =
    bannerImageUrl && bannerImageUrl.trim() !== ""
      ? bannerImageUrl
      : "/fallbacks/station-banner.png"; // ensure this exists in /public

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-gray-100">
      {/* Fixed Banner Image */}
      <div className="fixed left-0 top-0 z-0 h-64 w-full md:h-80 lg:h-96">
        <Image
          src={resolvedBanner}
          alt="Station Banner"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Scrollable Content Area */}
      <div
        className={`relative z-10 mt-56 bg-white px-4 transition-all duration-300 md:mt-72 lg:mt-96 
        ${isScrolled ? "rounded-t-none" : "rounded-t-4xl"} shadow-lg`}
      >
        <div>{children}</div>
      </div>
    </div>
  );
}