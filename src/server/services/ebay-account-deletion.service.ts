import { prisma } from "@/lib/prisma";
import { EbayClient } from "@/server/ebay/ebay.client";
import {
  parseEbayAccountDeletionPayload,
  parseEbaySignatureHeader,
  verifyEbayNotificationSignature,
} from "@/server/ebay/ebay-account-deletion";
import { getEbayConfigFromEnv } from "@/server/ebay/ebay.factory";

export async function handleEbayAccountDeletionNotification(input: {
  rawBody: string;
  signatureHeader: string | null;
}): Promise<void> {
  const parsed = JSON.parse(input.rawBody) as unknown;
  const notice = parseEbayAccountDeletionPayload(parsed);
  if (!notice) {
    return;
  }

  const verified = await verifyIncomingSignature(input.rawBody, parsed, input.signatureHeader);
  if (!verified) {
    return;
  }

  const alreadyProcessed = await prisma.auditLog.findFirst({
    where: {
      action: "EBAY_MARKETPLACE_ACCOUNT_DELETION",
      entityId: notice.notificationId,
    },
    select: { id: true },
  });
  if (alreadyProcessed) {
    return;
  }

  const result = await prisma.affiliateLink.updateMany({
    where: {
      sellerName: { equals: notice.username, mode: "insensitive" },
      marketplace: { code: "EBAY" },
    },
    data: { sellerName: null },
  });

  await prisma.auditLog.create({
    data: {
      action: "EBAY_MARKETPLACE_ACCOUNT_DELETION",
      entityType: "EbayUser",
      entityId: notice.notificationId,
      afterState: {
        clearedOfferCount: result.count,
        hasUserId: Boolean(notice.userId),
      },
    },
  });
}

async function verifyIncomingSignature(
  rawBody: string,
  parsedBody: unknown,
  signatureHeader: string | null,
): Promise<boolean> {
  const header = parseEbaySignatureHeader(signatureHeader);
  if (!header) {
    return false;
  }

  try {
    const client = new EbayClient(getEbayConfigFromEnv());
    const publicKey = await client.getNotificationPublicKey(header.kid);
    if (!publicKey) {
      return false;
    }
    return verifyEbayNotificationSignature({
      rawBody,
      parsedBody,
      signatureHeader: signatureHeader ?? "",
      publicKey,
    });
  } catch {
    return false;
  }
}
