import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";

// CORS config
const allowedOrigin = "https://chargefrog-control.vercel.app";

function corsResponse(body: any, status = 200) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function OPTIONS() {
  // Preflight request
  return corsResponse({}, 200);
}

export async function POST(request: Request) {
  try {
    const { walletAddress } = await request.json();
    if (!walletAddress) {
      return corsResponse(
        { error: "Missing walletAddress" },
        400
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

    return corsResponse({
      success: true,
      message: "Active charge removed.",
    });
  } catch (error: any) {
    return corsResponse(
      { error: "Failed to remove active charge", details: error.message },
      500
    );
  }
}
