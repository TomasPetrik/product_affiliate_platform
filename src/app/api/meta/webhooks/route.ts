import { env } from "@/lib/env";
import { handleMetaCommentWebhookPayload } from "@/server/services/meta-comment-webhook.service";
import { verifyMetaWebhookSignature } from "@/server/services/meta-comment-reply.service";
import { recordMetaWebhookEvent } from "@/server/services/meta-webhook-events.service";

export const dynamic = "force-dynamic";

/**
 * Meta webhook verification handshake.
 * App Dashboard → Webhooks → Callback URL: {NEXT_PUBLIC_SITE_URL}/api/meta/webhooks
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = env.META_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureOk = verifyMetaWebhookSignature(
    rawBody,
    request.headers.get("x-hub-signature-256"),
  );

  let payload: unknown = null;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    payload = null;
  }

  try {
    await recordMetaWebhookEvent({
      payload: payload ?? { parseError: true, rawLength: rawBody.length },
      signatureOk,
    });
  } catch {
    // Never fail the webhook ACK because logging failed.
  }

  if (!signatureOk) {
    return new Response("Invalid signature", { status: 401 });
  }

  if (payload === null) {
    return new Response("Invalid JSON", { status: 400 });
  }

  try {
    await handleMetaCommentWebhookPayload(payload);
  } catch {
    // Still 200 so Meta does not disable the subscription on transient errors.
  }

  return Response.json({ ok: true });
}
