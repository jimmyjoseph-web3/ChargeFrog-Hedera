import { NextRequest, NextResponse } from "next/server";

const DIDIT_API_URL = "https://verification.didit.me/v2/session/";
const WORKFLOW_ID = "1feed6ee-894e-4c06-99a9-db889bdbf78e";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      return NextResponse.json(
        { error: "walletAddress is required" },
        { status: 400 }
      );
    }

    const origin = req.nextUrl.origin;
    const CALLBACK_URL = `${origin}/profile`;

    const diditResponse = await fetch(DIDIT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.DIDIT_API_KEY as string,
      },
      body: JSON.stringify({
        workflow_id: WORKFLOW_ID,
        callback: CALLBACK_URL,
        vendor_data: walletAddress,
        metadata: { walletAddress },
      }),
    });

    const responseData = await diditResponse.json();
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("DiDiT verification error:", error);
    return NextResponse.json(
      { error: "Failed to create verification session" },
      { status: 500 }
    );
  }
}
