import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

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

    // Update isTxCompleted to true
    await activeChargeRef.update({ isTxCompleted: true });

    return NextResponse.json({
      success: true,
      message: "Transaction marked as completed.",
    });
  } catch (error: any) {
    console.error("Error in /api/completeTx:", error);
    return NextResponse.json(
      { error: "Failed to complete transaction", details: error.message },
      { status: 500 }
    );
  }
}
