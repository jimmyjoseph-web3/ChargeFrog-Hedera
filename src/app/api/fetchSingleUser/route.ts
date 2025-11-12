import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    const { walletAddress } = await request.json();
    if (!walletAddress) {
      return NextResponse.json(null, { status: 400 });
    }

    const userRef = db.ref(`users/${walletAddress}`);
    const snapshot = await userRef.get();

    return NextResponse.json(snapshot.exists() ? snapshot.val() : null);
  } catch {
    return NextResponse.json(null, { status: 500 });
  }
}
