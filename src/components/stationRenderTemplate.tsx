"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import React from "react";

interface StationRenderTemplateProps {
  bannerImageUrl: string;
  children: React.ReactNode;
}

export default function StationRenderTemplate({
  bannerImageUrl,
  children,
}: StationRenderTemplateProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 70); // adjust threshold as needed
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-gray-100">
      {/* Fixed Banner Image */}
      <div className="fixed top-0 left-0 w-full h-64 md:h-80 lg:h-96 z-0">
        <Image
          src={bannerImageUrl}
          alt="Station Banner"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Scrollable Content Area */}
      <div
        className={`relative px-4 z-10 mt-56 md:mt-72 lg:mt-96 bg-white 
          transition-all duration-300 
          ${isScrolled ? "rounded-t-none" : "rounded-t-4xl"} 
          shadow-lg`}
      >
        <div>{children}</div>
      </div>
    </div>
  );
}
