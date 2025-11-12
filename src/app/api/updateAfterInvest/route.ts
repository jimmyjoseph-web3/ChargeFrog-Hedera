import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    const { walletAddress, stationId, investAmount } = await request.json();

    if (!walletAddress || !stationId || typeof investAmount !== "number") {
      return NextResponse.json(
        { error: "Missing or invalid parameters" },
        { status: 400 }
      );
    }

    const userRef = db.ref(`users/${walletAddress}`);
    const stationRef = db.ref(`stations/${stationId}`);
    const investmentRef = db.ref(
      `users/${walletAddress}/investments/${stationId}`
    );

    // Fetch user and station data
    const [userSnap, stationSnap] = await Promise.all([
      userRef.get(),
      stationRef.get(),
    ]);

    const userData = userSnap.exists() ? userSnap.val() || {} : {};
    const stationData = stationSnap.exists() ? stationSnap.val() || {} : {};

    const recentInvestment = userData.recentInvestment || null;
    const currentStationKey = `ChargeFrog Station #${stationId}`;
    const totalShares = stationData.totalShares || 0;
    const prevIssued = stationData.numberOfSharesIssued || 0;
    const prevLargestInvestment = stationData.largestInvestment || 0;

    // === 1. Update station investor count if needed ===
    if (recentInvestment !== currentStationKey) {
      const newInvestorNumber = (stationData.investorNumber || 0) + 1;
      await stationRef.update({ investorNumber: newInvestorNumber });
    }

    // === 2. Update user recent investment ===
    await userRef.update({
      recentInvestment: currentStationKey,
      isInvestor: true,
      totalInvestHbar: (userData.totalInvestHbar || 0) + investAmount,
    });

    // === 3. Update station shares and token percentage ===
    const newNumberOfSharesIssued = prevIssued + investAmount;
    let newTokenIssuedOut = 0;
    if (totalShares > 0) {
      newTokenIssuedOut = (newNumberOfSharesIssued / totalShares) * 100;
    }

    // === 4. Update largest investment if this one is higher ===
    const newLargestInvestment =
      investAmount > prevLargestInvestment
        ? investAmount
        : prevLargestInvestment;

    await stationRef.update({
      numberOfSharesIssued: newNumberOfSharesIssued,
      tokenIssuedOut: newTokenIssuedOut,
      largestInvestment: newLargestInvestment,
    });

    // === 5. Add user investment record ===
    await investmentRef.set({
      investAmount,
      totalClaimed: 0,
    });

    return NextResponse.json({
      success: true,
      message: "Investment data updated successfully",
      data: {
        walletAddress,
        stationId,
        investAmount,
        newNumberOfSharesIssued,
        newTokenIssuedOut,
        newLargestInvestment,
      },
    });
  } catch (error: any) {
    console.error("❌ updateAfterInvest error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
