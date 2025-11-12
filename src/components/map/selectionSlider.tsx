"use client";

import React, { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface SelectionSliderProps {
  stations: Station[];
  userCoords: { lat: number; lng: number } | null; // passed from MapPage
  onSelect?: (station: Station) => void;
}

interface Station {
  stationId: string;
  thumbnailImageUrl: string;
  locationCategory: string;
  stationName: string;
  numberOfPort: number;
  locationCoordinates: string;
  portsInfo: { status: string }[];
}

const SelectionSlider: React.FC<SelectionSliderProps> = ({ stations, userCoords, onSelect }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const [cardWidth, setCardWidth] = useState(0);
  const [distances, setDistances] = useState<Record<string, string>>({});

  // Calculate haversine distance
  const getDistanceKm = (coordString?: string, user?: { lat: number; lng: number } | null) => {
    if (!user || !coordString) return null;

    const [latStr, lngStr] = coordString.split(",").map((s) => s.trim());
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (isNaN(lat) || isNaN(lng)) return null;

    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat - user.lat);
    const dLon = toRad(lng - user.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(user.lat)) * Math.cos(toRad(lat)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    if (isNaN(distance)) return null;
    return distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`;
  };

  // Precompute distances whenever stations or userCoords change
  useEffect(() => {
    if (!userCoords) return;

    const newDistances: Record<string, string> = {};
    stations.forEach((station) => {
      newDistances[station.stationId] = getDistanceKm(station.locationCoordinates, userCoords) ?? "—";
    });
    setDistances(newDistances);
  }, [stations, userCoords]);

  // Auto snap logic
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !cardWidth || stations.length === 0) return;

    let isScrolling: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(isScrolling);
      isScrolling = setTimeout(() => {
        const scrollCenter = container.scrollLeft + container.offsetWidth / 2;
        const nearestCardIndex = Math.round(scrollCenter / cardWidth - 0.5);
        const newScrollLeft =
          nearestCardIndex * cardWidth - container.offsetWidth / 2 + cardWidth / 2;

        container.scrollTo({ left: newScrollLeft, behavior: "smooth" });

        const nearest = stations[nearestCardIndex];
        if (nearest && onSelect) onSelect(nearest);
      }, 400);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [cardWidth, stations, onSelect]);

  // Measure card width
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const firstCard = container.querySelector<HTMLDivElement>(".card");
      if (firstCard) {
        const style = getComputedStyle(firstCard);
        const gap = parseFloat(style.marginRight) || 16;
        setCardWidth(firstCard.offsetWidth + gap);
      }
    }
  }, [stations]);

  return (
    <div className="fixed inset-x-0 bottom-[calc(15vh+0.1rem)] z-[900] flex justify-center">
      <motion.div
        ref={containerRef}
        className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory gap-4 scroll-smooth px-[calc(50%-9rem)]"
      >
        {stations.map((station) => {
          const available = station.portsInfo.some((p) => p.status.toLowerCase() === "available");

          return (
            <motion.div
              key={station.stationId}
              className="card flex-shrink-0 snap-center w-85 h-auto bg-white rounded-3xl p-4 flex flex-col justify-between"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
            >
              <div className="flex">
                <div className="flex-shrink-0 w-25 h-25">
                  <Image
                    src={station.thumbnailImageUrl}
                    alt={station.stationName}
                    width={85}
                    height={85}
                    priority
                    className="rounded-2xl object-cover w-full h-full"
                  />
                </div>
                <div className="flex flex-col justify-start ml-3 flex-1">
                  <div className="flex flex-wrap gap-1 text-xs font-light">
                    <span className="bg-gray-100 text-black px-2 py-1 rounded-md">{station.locationCategory}</span>
                    <span className="bg-gray-100 text-black px-2 py-1 rounded-md">Public</span>
                    <span className="bg-gray-100 text-black px-2 py-1 rounded-md">24/7</span>
                  </div>
                  <div className="text-lg font-semibold text-black truncate mt-2">{station.stationName}</div>
                  <div className="flex items-center gap-3 text-xs mt-4">
                    <div className={`flex items-center ${available ? "text-[#00dd00]" : "text-gray-300"}`}>
                      <Image src="/map/bolt.png" alt="bolt" width={14} height={14} />
                      <span className="font-medium">Available</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-700">
                      <Image src="/map/port.png" alt="port" width={14} height={14} />
                      <span className="font-medium">{station.numberOfPort}</span>
                    </div>
                    <div className="flex items-center gap-0.5 text-gray-700">
                      <Image src="/map/location.png" alt="location" width={14} height={14} />
                      <span className="font-medium">{distances[station.stationId] ?? "—"}</span>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => router.push(`/station/${station.stationId}`)}
                className="mt-4 w-full bg-black text-white rounded-2xl py-4 text-sm font-medium hover:bg-gray-800 transition"
              >
                I&apos;m here
              </button>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
};

export default SelectionSlider;
