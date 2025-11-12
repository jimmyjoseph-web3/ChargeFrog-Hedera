import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// Allowed origin for CORS
const ALLOWED_ORIGIN = "https://chargefrog-control.vercel.app";

export async function POST(request: Request) {
  try {
    // Check origin
    const origin = request.headers.get("origin");
    if (origin !== ALLOWED_ORIGIN) {
      return NextResponse.json({ error: "CORS not allowed" }, { status: 403 });
    }

    const { walletAddress } = await request.json();
    if (!walletAddress) {
      return NextResponse.json({ error: "Missing walletAddress" }, { status: 400 });
    }

    const activeChargeRef = db.ref(`users/${walletAddress}/activeCharge`);
    const snapshot = await activeChargeRef.get();

    if (!snapshot.exists()) {
      const response = NextResponse.json({ message: "No activeCharge found." });
      response.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
      response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type");
      return response;
    }

    await activeChargeRef.remove();

    const response = NextResponse.json({
      success: true,
      message: "Active charge removed.",
    });
    response.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    return response;
  } catch (error: any) {
    const response = NextResponse.json(
      { error: "Failed to remove active charge", details: error.message },
      { status: 500 }
    );
    response.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    return response;
  }
}

// Handle preflight OPTIONS requests
export async function OPTIONS() {
  const response = NextResponse.json({});
  response.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}
