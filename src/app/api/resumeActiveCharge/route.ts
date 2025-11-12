import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing walletAddress" },
        { status: 400 }
      );
    }

    const activeChargeRef = db.ref(`users/${walletAddress}/activeCharge`);

    // Check if activeCharge exists
    const snapshot = await activeChargeRef.get();
    if (!snapshot.exists()) {
      return NextResponse.json(
        { error: "No activeCharge found for this user" },
        { status: 404 }
      );
    }

    // Delete totalKWhCharged and totalCreditSpend
    await activeChargeRef.child("totalKWhCharged").remove();
    await activeChargeRef.child("totalCreditSpend").remove();

    return NextResponse.json({
      success: true,
      message: "Active charge resumed. Totals removed.",
    });
  } catch (error: any) {
    console.error("Error in /api/resumeActiveCharge:", error);
    return NextResponse.json(
      { error: "Failed to resume active charge", details: error.message },
      { status: 500 }
    );
  }
}
