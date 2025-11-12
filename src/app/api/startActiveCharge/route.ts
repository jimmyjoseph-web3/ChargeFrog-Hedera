import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    // Enable CORS for your external domain
    const origin = request.headers.get("origin");
    if (origin !== "https://chargefrog-control.vercel.app") {
      return NextResponse.json({ error: "CORS not allowed" }, { status: 403 });
    }

    const { walletAddress } = await request.json();
    if (!walletAddress) {
      return NextResponse.json({ error: "Missing walletAddress" }, { status: 400 });
    }

    const activeChargeRef = db.ref(`users/${walletAddress}/activeCharge`);
    const snapshot = await activeChargeRef.get();

    if (!snapshot.exists()) {
      return NextResponse.json({ message: "No activeCharge found." });
    }

    await activeChargeRef.update({
      isWarmingUp: false,
      // startTimestamp: Date.now()
      startTimestamp: Date.now() - (5 * 60 * 1000) // add 20 minutes: REMOVE THIS IN PROD
    });

    const response = NextResponse.json({
      success: true,
      message: "Active charge updated.",
    });

    // Set CORS headers
    response.headers.set("Access-Control-Allow-Origin", "https://chargefrog-control.vercel.app");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return response;
  } catch (error: any) {
    const response = NextResponse.json(
      { error: "Failed to update active charge", details: error.message },
      { status: 500 }
    );

    response.headers.set("Access-Control-Allow-Origin", "https://chargefrog-control.vercel.app");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return response;
  }
}

// Handle preflight OPTIONS request
export async function OPTIONS() {
  const response = NextResponse.json({});
  response.headers.set("Access-Control-Allow-Origin", "https://chargefrog-control.vercel.app");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}
