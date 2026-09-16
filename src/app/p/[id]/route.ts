import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { parseProductPublicId } from "@/lib/product-short-url";
import { resolvePublishedProductPathByPublicId } from "@/server/services/catalog.service";

export const dynamic = "force-dynamic";

/**
 * Short public hop for Instagram / social: `/p/42` → `/products/{slug}`.
 * Keeps the long slug as the canonical product URL.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const home = new URL("/", env.NEXT_PUBLIC_SITE_URL);
  const publicId = parseProductPublicId(id);

  if (publicId == null) {
    return NextResponse.redirect(home, 302);
  }

  const path = await resolvePublishedProductPathByPublicId(publicId);
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
