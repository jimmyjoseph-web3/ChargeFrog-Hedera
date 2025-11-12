"use client";

import { useEffect, useState } from "react";
import FloatingMenuBar from "../components/floatingMenuBar";
import SelectionSlider from "../components/map/selectionSlider";
import ActiveChargeReminder from "../components/map/activeChargeReminder";
import {
  APIProvider,
  Map as VisMap,
  Marker,
  useMap,
} from "@vis.gl/react-google-maps";
import { useAccount } from "wagmi";

interface Station {
  stationId: string;
  thumbnailImageUrl: string;
  locationCategory: string;
  stationName: string;
  numberOfPort: number;
  locationCoordinates: string;
  portsInfo: { status: string }[];
}

const parseCoordinates = (
  coordString: string
): { lat: number; lng: number } | null => {
  if (!coordString) return null;
  const [latStr, lngStr] = coordString.split(",").map((s) => s.trim());
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
};

export const PanToStation = ({
  activeStation,
  targetZoom = 15,
}: {
  activeStation: Station | null;
  targetZoom?: number;
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !activeStation) return;

    const coords = parseCoordinates(activeStation.locationCoordinates);
    if (!coords) return;

    const currentZoom = map.getZoom() ?? targetZoom;

    const distance = google.maps.geometry.spherical.computeDistanceBetween(
      map.getCenter()!,
      new google.maps.LatLng(coords.lat, coords.lng)
    );

    const zoomOutLevel = distance > 5000 ? 13 : currentZoom;

    if (zoomOutLevel < currentZoom) {
      map.setZoom(zoomOutLevel);
      setTimeout(() => {
        map.panTo(coords);
        setTimeout(() => {
          map.setZoom(targetZoom);
        }, 200);
      }, 200);
    } else {
      map.panTo(coords);
    }
  }, [activeStation, map, targetZoom]);

  return null;
};

export default function MapPage() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP;
  const [stations, setStations] = useState<Station[]>([]);
  const [activeStation, setActiveStation] = useState<Station | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // wagmi hook
  const { address, isConnected } = useAccount();

  // State to store user wallet address
  const [USER, setUSER] = useState<string>("");

  // Set USER whenever wallet address changes
  useEffect(() => {
    if (address) {
      setUSER(address);
    } else {
      setUSER(""); // reset if disconnected
    }
  }, [address]);

  if (!apiKey) return <p>Error: Google Maps API key is missing.</p>;

  // Get user location
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) =>
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      (err) => console.warn("Geolocation failed:", err.message),
      { enableHighAccuracy: true }
    );
  }, []);

  // Fetch stations
  useEffect(() => {
    const fetchStations = async () => {
      const res = await fetch("/api/fetchAllStations");
      const data = await res.json();
      setStations(data.stations || []);
    };
    fetchStations();
  }, []);

  // Show loader if location not yet obtained
  if (!userLocation) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-gray-700 mb-2">
        <img
          src="/station/frog-loader.gif"
          alt="Loading frog"
          className="w-60 h-50 -m-6"
        />
      </div>
    );
  }

  const markerIcon = "/location-marker.png";
  const userMarkerIcon = "/user-location-marker.png";

  return (
    <>
      <ActiveChargeReminder walletAddress={USER} />
      <FloatingMenuBar />
      <SelectionSlider
        stations={stations}
        onSelect={setActiveStation}
        userCoords={userLocation}
      />

      <APIProvider apiKey={apiKey} libraries={["geometry"]}>
        <VisMap
          style={{ width: "100vw", height: "100vh" }}
          defaultZoom={15}
          defaultCenter={userLocation}
          gestureHandling="greedy"
          disableDefaultUI
        >
          {stations.map((s) => {
            const coords = parseCoordinates(s.locationCoordinates);
            if (!coords) return null;
            return (
              <Marker
                key={s.stationId}
                position={coords}
                icon={{
                  url: markerIcon,
                  scaledSize: { width: 50, height: 55 } as unknown as google.maps.Size,
                }}
                title={s.stationName}
              />
            );
          })}

          <Marker
            position={userLocation}
            icon={{
              url: userMarkerIcon,
              scaledSize: { width: 50, height: 70 } as unknown as google.maps.Size,
            }}
            title="Your Location"
            zIndex={10}
          />
        </VisMap>
        <PanToStation activeStation={activeStation} />
      </APIProvider>
    </>
  );
}
