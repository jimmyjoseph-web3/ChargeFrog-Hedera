import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { stationId } = body;

    if (!stationId) {
      return NextResponse.json({ error: "Missing stationId in request body" }, { status: 400 });
    }

    const snapshot = await db.ref(`stations/${stationId}`).once("value");
    const data = snapshot.val();

    if (!data) {
      return NextResponse.json({ error: "Station not found" }, { status: 404 });
    }

    return NextResponse.json({ stationId, ...data }, { status: 200 });
  } catch (error) {
    console.error("Error fetching station:", error);
    return NextResponse.json({ error: "Failed to fetch station" }, { status: 500 });
  }
}
