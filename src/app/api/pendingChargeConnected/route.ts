import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

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

    await pendingChargeRef.update({ isConnected: true });

    return NextResponse.json({ success: true, message: "isConnected updated to true." });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update isConnected", details: error.message },
      { status: 500 }
    );
  }
}
