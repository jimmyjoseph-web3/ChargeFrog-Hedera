import { NextResponse } from "next/server";
import { db } from "../../../lib/firebaseAdmin";
export async function POST(request: Request) {
  try {
    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing walletAddress" },
        { status: 400 }
      );
    }

    const userRef = db.ref(`users/${walletAddress}`);

    // Create the new user entry
    await userRef.set({
      isInvestor: false,
      totalChargeKWh: 0,
      offsetCo2: 0,
      totalInvestHbar: 0,
      totalHbarEarnings: 0,
      boltCreditAmount: 0
    });

    return NextResponse.json(
      { message: "User registered successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error registering user:", error);
    return NextResponse.json(
      { error: "Failed to register user" },
      { status: 500 }
    );
  }
}
