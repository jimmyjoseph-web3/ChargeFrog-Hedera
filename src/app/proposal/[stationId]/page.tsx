"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import FloatingMenuBar from "@/src/components/floatingMenuBar";
import FloatingMenuBarBgCover from "@/src/components/floatingMenuBarBgCover";
import StationRenderTemplate from "@/src/components/stationRenderTemplate";
import Loader from "@/src/components/proposal/loader";
import EmptyState from "@/src/components/proposal/emptyState";
import ProposalContent from "@/src/components/proposal/proposalContent";
import type { StationData } from "@/src/components/proposal/proposalFormatters";

export default function ProposalDetailPage() {
  const params = useParams<{ stationId: string }>();
  const stationId = Number(params.stationId);
  const [station, setStation] = useState<StationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (Number.isNaN(stationId)) {
      setLoading(false);
      return;
    }

    const fetchStation = async () => {
      try {
        const res = await fetch("/api/fetchSingleStation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stationId }),
        });

        if (!res.ok) {
          throw new Error("Failed to fetch station");
        }

        const data = (await res.json()) as StationData;
        setStation(data);
      } catch (err) {
        console.error("Error fetching station:", err);
        setStation(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStation();
  }, [stationId]);

  if (loading) {
    return <Loader />;
  }

  if (!station) {
    return <EmptyState />;
  }

  return (
    <>
      <FloatingMenuBar />
      <FloatingMenuBarBgCover />
      <StationRenderTemplate bannerImageUrl={station.bannerImageUrl ?? ""}>
        <ProposalContent station={station} />
      </StationRenderTemplate>
    </>
  );
}