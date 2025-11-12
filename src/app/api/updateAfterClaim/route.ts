import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    const { walletAddress, stationId, claimedAmount } = await request.json();

    if (!walletAddress || !stationId || claimedAmount == null) {
      return NextResponse.json(
        { error: "Missing walletAddress, stationId, or claimedAmount" },
        { status: 400 }
      );
    }

    const userRef = db.ref(`users/${walletAddress}`);
    const totalEarningsRef = userRef.child("totalHbarEarnings");
    const stationClaimRef = userRef.child(`investments/${stationId}/totalClaimed`);

    // === Use transactions to safely increment existing values ===
    await Promise.all([
      totalEarningsRef.transaction((prev) => (prev || 0) + claimedAmount),
      stationClaimRef.transaction((prev) => (prev || 0) + claimedAmount),
    ]);

    return NextResponse.json({
      success: true,
      message: "User earnings updated successfully",
      walletAddress,
      stationId,
      claimedAmount,
    });
  } catch (error) {
    console.error("❌ Error updating claim data:", error);
    return NextResponse.json(
      { error: "Failed to update claim data", details: String(error) },
      { status: 500 }
    );
  }
}
