import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    const { walletAddress, stationId, bayNumber, isWarmingUp } = await request.json();
    if (!walletAddress || !stationId || !bayNumber) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const activeChargeRef = db.ref(`users/${walletAddress}/activeCharge`);
    await activeChargeRef.set({
      stationId,
      bayNumber,
      isWarmingUp,
    });

    return NextResponse.json({ success: true, message: "Active charge set." });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to set active charge", details: error.message },
      { status: 500 }
    );
  }
}
