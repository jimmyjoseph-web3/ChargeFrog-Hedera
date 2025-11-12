"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import FloatingMenuBar from "@/src/components/floatingMenuBar";
import FloatingMenuBarBgCover from "@/src/components/floatingMenuBarBgCover";
import StationRenderTemplate from "@/src/components/stationRenderTemplate";
import Loader from "@/src/components/proposal/loader";
import EmptyState from "@/src/components/proposal/emptyState";
import ProposalContent from "@/src/components/proposal/proposalContent";

type Station = {
  stationId: number;
  stationName: string;
  bannerImageUrl: string;
  hbarPriceAtCreation: number;
  [key: string]: any;
};

export default function ProposalDetailPage() {
  const params = useParams<{ stationId: string }>();
  const stationId = Number(params.stationId);
  const [station, setStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isNaN(stationId)) return;

    const fetchStation = async () => {
      try {
        const res = await fetch("/api/fetchSingleStation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stationId }),
        });

        if (!res.ok) throw new Error("Failed to fetch station");

        const data: Station = await res.json();
        setStation(data);
      } catch (err) {
        console.error("Error fetching station:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStation();
  }, [stationId]);

  // Loading State
  if (loading) {
    return <Loader />;
  }

  // Empty State
  if (!station) {
    return <EmptyState />;
  }

  // Station Display
  return (
    <>
      <FloatingMenuBar />
      <FloatingMenuBarBgCover />
      <StationRenderTemplate bannerImageUrl={station.bannerImageUrl}>
        <ProposalContent station={station} />
      </StationRenderTemplate>
    </>
  );
}
