import { NextRequest, NextResponse } from "next/server";

const FROGGY_PLANNER_A2A_URL =
  "https://froggyplanner.onrender.com/api/a2a/froggy-planner";

export async function POST(req: NextRequest) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const body = await req.json();

    const response = await fetch(FROGGY_PLANNER_A2A_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }

    const text = await response.text();

    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": contentType || "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("froggy-planner-a2a proxy error:", error);

    return NextResponse.json(
      {
        error: "Failed to call froggy-planner-a2a.",
      },
      { status: 500 },
    );
  } finally {
    clearTimeout(timeout);
  }
}