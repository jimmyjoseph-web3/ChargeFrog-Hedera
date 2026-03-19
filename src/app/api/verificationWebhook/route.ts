import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/firebaseAdmin";

const WEBHOOK_SECRET_KEY = process.env.DIDIT_WEBHOOK_KEY as string;

async function getRawBody(req: NextRequest): Promise<string> {
  const buffer = await req.arrayBuffer();
  return Buffer.from(buffer).toString("utf8");
}

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-signature");
    const timestamp = req.headers.get("x-timestamp");

    if (!signature || !timestamp || !WEBHOOK_SECRET_KEY) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await getRawBody(req);

    // Validate timestamp (within 5 mins)
    const currentTime = Math.floor(Date.now() / 1000);
    const incomingTime = parseInt(timestamp, 10);
    if (Math.abs(currentTime - incomingTime) > 300) {
      return NextResponse.json({ message: "Request timestamp is stale." }, { status: 401 });
    }

    // Validate HMAC signature
    const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET_KEY);
    const expectedSignature = hmac.update(rawBody).digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const providedBuffer = Buffer.from(signature, "utf8");

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
    }

    // Parse JSON body
    const body = JSON.parse(rawBody);
    const { webhook_type, vendor_data, status } = body;

    // Only process status updates
    if (webhook_type === "status.updated" && vendor_data && status) {
      const userRef = db.ref(`users/${vendor_data}`);
      const updates: Record<string, any> = {};

      if (status === "Approved") {
        updates.isVerified = true;
        updates.verificationStatus = status;
        console.log(`Marked ${vendor_data} as verified`);
      } else if (status === "Declined") {
        updates.isVerified = false;
        updates.verificationStatus = null; // remove the field
        console.log(`Marked ${vendor_data} as not verified (Declined)`);
      } else {
        // For other statuses, just update verificationStatus
        updates.verificationStatus = status;
        console.log(`Updated ${vendor_data} verificationStatus to ${status}`);
      }

      await userRef.update(updates);
    }

    return NextResponse.json({ message: "Webhook processed" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
