import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {

  const ua = req.headers.get("user-agent") || "";
  const isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua.toLowerCase());

  // Skip unsupported page, static assets, API routes
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/unsupported") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  // Redirect desktop users
  if (!isMobile) {
    const url = req.nextUrl.clone();
    url.pathname = "/unsupported";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
