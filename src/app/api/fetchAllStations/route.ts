import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";

export async function GET() {
  try {
    const snapshot = await db.ref("stations").once("value");
    const data = snapshot.val();

    if (!data) {
      return NextResponse.json({ stations: [] }, { status: 200 });
    }

    const stations = Object.entries(data)
      // Filter only numeric keys of stations
      .filter(([key, value]: [string, any]) => {
        const isNumericKey = !isNaN(Number(key));
        const hasPortsInfo = value && Array.isArray(value.portsInfo);
        return isNumericKey || hasPortsInfo;
      })
      // Map into Station objects
      .map(([stationId, value]: [string, any]) => ({
        stationId,
        ...value,
      }));

    return NextResponse.json({ stations });
  } catch (error) {
    console.error("Error fetching stations:", error);
    return NextResponse.json(
      { error: "Failed to fetch stations" },
      { status: 500 }
    );
  }
}
