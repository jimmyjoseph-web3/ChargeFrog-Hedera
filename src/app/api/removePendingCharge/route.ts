import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    const { walletAddress } = await request.json();
    if (!walletAddress) {
      return NextResponse.json({ error: "Missing walletAddress" }, { status: 400 });
    }

    const pendingChargeRef = db.ref(`users/${walletAddress}/pendingCharge`);
    const snapshot = await pendingChargeRef.get();

    if (!snapshot.exists()) {
      return NextResponse.json({ message: "No pendingCharge found." });
    }

    await pendingChargeRef.remove();
    return NextResponse.json({ success: true, message: "Pending charge removed." });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to remove pending charge", details: error.message },
      { status: 500 }
    );
  }
}
