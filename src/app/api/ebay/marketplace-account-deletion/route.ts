import { env } from "@/lib/env";
import {
  ebayChallengeResponse,
  ebayNotificationEndpoint,
} from "@/server/ebay/ebay-account-deletion";
import { handleEbayAccountDeletionNotification } from "@/server/services/ebay-account-deletion.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const challengeCode = new URL(request.url).searchParams.get("challenge_code")?.trim();
  const token = env.EBAY_NOTIFICATION_VERIFICATION_TOKEN;
  if (!challengeCode || !token) {
    return Response.json({ error: "Not configured" }, { status: 400 });
  }

  return Response.json(
    {
      challengeResponse: ebayChallengeResponse(
        challengeCode,
        token,
        ebayNotificationEndpoint(env.NEXT_PUBLIC_SITE_URL, env.EBAY_NOTIFICATION_ENDPOINT),
      ),
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    await handleEbayAccountDeletionNotification({
      rawBody,
      signatureHeader: request.headers.get("x-ebay-signature"),
    });
  } catch {
    // Always acknowledge so eBay's endpoint test succeeds; invalid payloads are ignored.
  }

  return Response.json({ ok: true });
}
