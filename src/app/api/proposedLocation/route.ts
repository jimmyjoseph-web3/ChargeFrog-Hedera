import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    const { proposedLocation } = await request.json();

    if (!proposedLocation || typeof proposedLocation !== "string") {
      return NextResponse.json(
        { error: "Invalid or missing 'proposedLocation' parameter" },
        { status: 400 }
      );
    }

    const newRef = db.ref("proposedLocation").push();
    await newRef.set({
      location: proposedLocation,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        message: "Location proposal added successfully",
        id: newRef.key,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error adding proposed location:", error);
    return NextResponse.json(
      { error: "Failed to add proposed location" },
      { status: 500 }
    );
  }
}
