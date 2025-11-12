import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text");

  if (!text) {
    return NextResponse.json({ error: "Missing query text" }, { status: 400 });
  }

  const apiKey = process.env.GEOAPIFY_API_KEY;
  const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
    text
  )}&apiKey=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const results = data.features?.map(
      (f: any) => f.properties.formatted
    ) ?? [];

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Geoapify error:", error);
    return NextResponse.json({ error: "Failed to fetch autocomplete" }, { status: 500 });
  }
}
