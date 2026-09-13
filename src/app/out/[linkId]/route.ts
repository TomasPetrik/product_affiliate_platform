import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { resolveAffiliateGoPathFromLinkId } from "@/server/services/affiliate-redirect.service";

export const dynamic = "force-dynamic";

/**
 * Legacy hop that used internal affiliate-link ids.
 * Forwards to `/go/[productSlug]` so clicks are recorded on the public route.
 */
export async function GET(request: Request, context: { params: Promise<{ linkId: string }> }) {
  const { linkId } = await context.params;
  const home = new URL("/", env.NEXT_PUBLIC_SITE_URL);
  const path = await resolveAffiliateGoPathFromLinkId(linkId);

  if (!path) {
    return NextResponse.redirect(home, 302);
  }

  const destination = new URL(path, env.NEXT_PUBLIC_SITE_URL);
  const incoming = new URL(request.url);
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const value = incoming.searchParams.get(key);
    if (value) destination.searchParams.set(key, value);
  }

  const response = NextResponse.redirect(destination, 302);
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
