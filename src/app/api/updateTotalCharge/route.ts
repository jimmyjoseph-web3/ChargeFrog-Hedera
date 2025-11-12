// app/api/ev/charge/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { convertKwhToCo2Offset } from "@/utils/co2Offset";

interface ChargeRequestBody {
  walletAddress: string;
  totalKWhCharged: number;
  totalCreditSpend: number;
}

export async function POST(request: Request) {
  try {
    const body: ChargeRequestBody = await request.json();
    const { walletAddress, totalKWhCharged, totalCreditSpend } = body;

    if (!walletAddress || totalKWhCharged == null || totalCreditSpend == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Directly update the user data in Firebase
    const userRef = db.ref(`users/${walletAddress}`);

    const snapshot = await userRef.once("value");
    if (!snapshot.exists()) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = snapshot.val();
    const updatedTotalChargeKWh = (userData.totalChargeKWh || 0) + totalKWhCharged;
    const offsetCo2 = convertKwhToCo2Offset(updatedTotalChargeKWh);
    const updatedBoltCreditAmount = (userData.boltCreditAmount || 0) - totalCreditSpend;

    await userRef.set({
      ...userData,
      totalChargeKWh: updatedTotalChargeKWh,
      offsetCo2,
      boltCreditAmount: updatedBoltCreditAmount,
    });

    return NextResponse.json({
      message: "User data updated successfully",
      data: {
        totalChargeKWh: updatedTotalChargeKWh,
        offsetCo2,
        boltCreditAmount: updatedBoltCreditAmount,
      },
    });
  } catch (error: any) {
    console.error("Error updating user charge:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
