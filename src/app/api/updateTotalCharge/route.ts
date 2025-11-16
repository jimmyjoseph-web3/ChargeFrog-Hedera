// app/api/ev/charge/route.ts
import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";
import { convertKwhToCo2Offset } from "@/src/utils/co2Offset";

const MINT_ENDPOINT = "https://chargefrog-hedera-guardian.vercel.app/api/mint";
const WIPE_ENDPOINT = "https://chargefrog-hedera-guardian.vercel.app/api/wipe";

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
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const userRef = db.ref(`users/${walletAddress}`);
    const snapshot = await userRef.once("value");

    if (!snapshot.exists()) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = snapshot.val();

    // -----------------------------
    // Force numeric conversions
    // -----------------------------
    const previousTotalChargeKWh = Number(userData.totalChargeKWh) || 0;
    const previousOffset = Number(userData.offsetCo2) || 0;
    const previousBoltCreditAmount = Number(userData.boltCreditAmount) || 0;
    const previousWipeCount = Number(userData.currentWipeRange) || 0;

    // -----------------------------
    // Compute new values
    // -----------------------------
    const updatedTotalChargeKWh =
      previousTotalChargeKWh + totalKWhCharged;

    const newOffset = convertKwhToCo2Offset(updatedTotalChargeKWh); // grams

    const updatedBoltCreditAmount =
      previousBoltCreditAmount - totalCreditSpend;

    // -----------------------------
    // MINT LOGIC (every 100g)
    // -----------------------------
    const previousMintCount = Math.floor(previousOffset / 100);
    const newMintCount = Math.floor(newOffset / 100);
    const mintsToDo = newMintCount - previousMintCount;

    for (let i = 0; i < mintsToDo; i++) {
      const timestamp = new Date().toISOString();

      const mintPayload = {
        document: {
          field0: "N/A",
          field1: walletAddress,
          field2: "N/A",
          field3: "1",
          field4: `${timestamp} Recorded 100 grams of CO2 Offset from ${walletAddress}`,
        },
      };

      await fetch(MINT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mintPayload),
      });
    }

    // -----------------------------
    // WIPE LOGIC (every 1000g)
    // -----------------------------
    const previousKg = Math.floor(previousOffset / 1000);
    const newKg = Math.floor(newOffset / 1000);
    const wipesToDo = newKg - previousKg;

    let updatedWipeCount = previousWipeCount;

    for (let i = 0; i < wipesToDo; i++) {
      const wipePayload = {
        document: {
          field1: "", // ALWAYS EMPTY — no range needed
        },
      };

      await fetch(WIPE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wipePayload),
      });

      updatedWipeCount += 1; // increment the wipe flag
    }

    // -----------------------------
    // Save to Firebase
    // -----------------------------
    await userRef.set({
      ...userData,
      totalChargeKWh: updatedTotalChargeKWh,
      offsetCo2: newOffset,
      boltCreditAmount: updatedBoltCreditAmount,
      currentWipeRange: updatedWipeCount, // now just a counter
    });

    return NextResponse.json({
      message: "User data updated successfully",
      data: {
        totalChargeKWh: updatedTotalChargeKWh,
        offsetCo2: newOffset,
        boltCreditAmount: updatedBoltCreditAmount,
        currentWipeRange: updatedWipeCount,
      },
    });
  } catch (error: any) {
    console.error("Error updating charge + mint + wipe:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
