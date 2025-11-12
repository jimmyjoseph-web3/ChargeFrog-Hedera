import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    const { walletAddress, stationId, bayNumber } = await request.json();
    if (!walletAddress || !stationId || !bayNumber) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const pendingChargeRef = db.ref(`users/${walletAddress}/pendingCharge`);
    await pendingChargeRef.set({
      stationId,
      bayNumber,
      isConnected: false,
    });

    return NextResponse.json({ success: true, message: "Pending charge added." });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to add pending charge", details: error.message },
      { status: 500 }
    );
  }
}
