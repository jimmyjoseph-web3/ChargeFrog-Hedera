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
    const snapshot = await activeChargeRef.once("value");

    if (!snapshot.exists()) {
      console.log("No activeCharge found");
    } else {
      await activeChargeRef.remove();
      console.log("Active charge removed");
    }

    return NextResponse.json({
      success: true,
      message: "Active charge removed.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to remove active charge", details: error.message },
      { status: 500 }
    );
  }
}
