import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (the `middleware`
// convention is deprecated as of v16.0.0). See
// https://nextjs.org/docs/app/api-reference/file-conventions/proxy

const PUBLIC_ADMIN_PATHS = new Set(["/admin/login"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Static string required by Next.js compile-time parsing. Keep in sync with
  // ADMIN_PROXY_MATCHER in src/lib/admin-routes.ts.
  matcher: ["/admin/:path*"],
};
