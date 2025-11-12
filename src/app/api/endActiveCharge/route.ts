import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    const { walletAddress, totalKWhCharged, totalCreditSpend } = await request.json();
    if (!walletAddress || totalKWhCharged === undefined || totalCreditSpend === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const activeChargeRef = db.ref(`users/${walletAddress}/activeCharge`);
    const snapshot = await activeChargeRef.get();

    if (!snapshot.exists()) {
      return NextResponse.json({ message: "No activeCharge found." });
    }

    await activeChargeRef.update({
      totalKWhCharged,
      totalCreditSpend,
    });

    return NextResponse.json({ success: true, message: "Active charge data updated." });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update active charge data", details: error.message },
      { status: 500 }
    );
  }
}
