import { createHash, createVerify } from "node:crypto";

export const EBAY_ACCOUNT_DELETION_PATH = "/api/ebay/marketplace-account-deletion";

export interface EbayAccountDeletionNotice {
  notificationId: string;
  username: string;
  userId: string | null;
}

export function ebayNotificationEndpoint(siteUrl: string, configuredEndpoint?: string): string {
  if (configuredEndpoint) {
    return configuredEndpoint.replace(/\/$/, "");
  }
  return `${siteUrl.replace(/\/$/, "")}${EBAY_ACCOUNT_DELETION_PATH}`;
}

/** SHA-256 hex of challengeCode + verificationToken + endpoint, in that order. */
export function ebayChallengeResponse(
  challengeCode: string,
  verificationToken: string,
  endpoint: string,
): string {
  return createHash("sha256")
    .update(challengeCode)
    .update(verificationToken)
    .update(endpoint)
    .digest("hex");
}

export function parseEbayAccountDeletionPayload(body: unknown): EbayAccountDeletionNotice | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const record = body as {
    metadata?: { topic?: string };
    notification?: {
      notificationId?: string;
      data?: { username?: string; userId?: string };
    };
  };

  const topic = record.metadata?.topic?.trim();
  if (topic && topic !== "MARKETPLACE_ACCOUNT_DELETION") {
    return null;
  }

  const notificationId = record.notification?.notificationId?.trim();
  const username = record.notification?.data?.username?.trim();
  if (!notificationId || !username) {
    return null;
  }

  const userId = record.notification?.data?.userId?.trim() || null;
  return { notificationId, username, userId };
}

export function parseEbaySignatureHeader(header: string | null): { kid: string; signature: string } | null {
  if (!header) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(header, "base64").toString("ascii")) as {
      kid?: string;
      signature?: string;
    };
    const kid = parsed.kid?.trim();
    const signature = parsed.signature?.trim();
    if (!kid || !signature) {
      return null;
    }
    return { kid, signature };
  } catch {
    return null;
  }
}

export function formatEbayNotificationPublicKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.includes("BEGIN PUBLIC KEY")) {
    return trimmed
      .replace(/-----BEGIN PUBLIC KEY-----/, "-----BEGIN PUBLIC KEY-----\n")
      .replace(/-----END PUBLIC KEY-----/, "\n-----END PUBLIC KEY-----");
  }
  return `-----BEGIN PUBLIC KEY-----\n${trimmed}\n-----END PUBLIC KEY-----`;
}

export function verifyEbayNotificationSignature(input: {
  rawBody: string;
  parsedBody: unknown;
  signatureHeader: string;
  publicKey: string;
}): boolean {
  const header = parseEbaySignatureHeader(input.signatureHeader);
  if (!header) {
    return false;
  }

  const pem = formatEbayNotificationPublicKey(input.publicKey);
  const payloads = [input.rawBody, JSON.stringify(input.parsedBody)];
  const algorithms = ["SHA1", "ssl3-sha1", "SHA256"];

  for (const algorithm of algorithms) {
    for (const payload of payloads) {
      try {
        const verifier = createVerify(algorithm);
        verifier.update(payload);
        if (verifier.verify(pem, header.signature, "base64")) {
          return true;
        }
      } catch {
        // Node/OpenSSL may not support every legacy algorithm name.
      }
    }
  }

  return false;
}
