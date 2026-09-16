import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { refreshEbayOffer } from "@/server/services/ebay-import.service";
import { revalidateProductPage, revalidatePublicCatalog } from "@/server/services/revalidate";

export const PRICE_SYNC_BATCH_SIZE = 5;

export class PriceSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PriceSyncError";
  }
}

export interface PriceSyncRunSummary {
  id: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  trigger: "MANUAL" | "CRON";
  totalOffers: number;
  processedOffers: number;
  changedOffers: number;
  failedOffers: number;
  unchangedOffers: number;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  percentComplete: number;
  isActive: boolean;
}

export interface PriceSyncChangeRow {
  id: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  marketplaceCode: string;
  externalProductId: string;
  oldPrice: number | null;
  newPrice: number | null;
  oldOriginalPrice: number | null;
  newOriginalPrice: number | null;
  currency: string | null;
  oldAvailability: string | null;
  newAvailability: string | null;
}

function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  return value == null ? null : Number(value);
}

function pricesEqual(a: number | null, b: number | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 0.005;
}

function toRunSummary(run: {
  id: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  trigger: "MANUAL" | "CRON";
  totalOffers: number;
  processedOffers: number;
  changedOffers: number;
  failedOffers: number;
  unchangedOffers: number;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}): PriceSyncRunSummary {
  const percentComplete =
    run.totalOffers === 0 ? 100 : Math.min(100, Math.round((run.processedOffers / run.totalOffers) * 100));

  return {
    id: run.id,
    status: run.status,
    trigger: run.trigger,
    totalOffers: run.totalOffers,
    processedOffers: run.processedOffers,
    changedOffers: run.changedOffers,
    failedOffers: run.failedOffers,
    unchangedOffers: run.unchangedOffers,
    errorMessage: run.errorMessage,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    percentComplete,
    isActive: run.status === "PENDING" || run.status === "RUNNING",
  };
}

async function listEbayOfferIdsForSync(): Promise<string[]> {
  const offers = await prisma.affiliateLink.findMany({
    where: {
      isActive: true,
      marketplace: { code: "EBAY" },
    },
    select: { id: true },
    orderBy: [{ lastSyncedAt: "asc" }, { createdAt: "asc" }],
  });
  return offers.map((offer) => offer.id);
}

export async function getActivePriceSyncRun(): Promise<PriceSyncRunSummary | null> {
  const run = await prisma.priceSyncRun.findFirst({
    where: { status: { in: ["PENDING", "RUNNING"] } },
    orderBy: { createdAt: "desc" },
  });
  return run ? toRunSummary(run) : null;
}

export async function getPriceSyncRunById(id: string): Promise<PriceSyncRunSummary | null> {
  const run = await prisma.priceSyncRun.findUnique({ where: { id } });
  return run ? toRunSummary(run) : null;
}

export async function listPriceSyncRuns(limit = 20): Promise<PriceSyncRunSummary[]> {
  const runs = await prisma.priceSyncRun.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return runs.map(toRunSummary);
}

export async function getLatestCompletedPriceSyncRun(): Promise<PriceSyncRunSummary | null> {
  const run = await prisma.priceSyncRun.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { finishedAt: "desc" },
  });
  return run ? toRunSummary(run) : null;
}

export async function listPriceSyncChanges(runId: string): Promise<PriceSyncChangeRow[]> {
  const changes = await prisma.priceSyncChange.findMany({
    where: { runId },
    orderBy: { createdAt: "asc" },
  });

  return changes.map((change) => ({
    id: change.id,
    productId: change.productId,
    productTitle: change.productTitle,
    productSlug: change.productSlug,
    marketplaceCode: change.marketplaceCode,
    externalProductId: change.externalProductId,
    oldPrice: decimalToNumber(change.oldPrice),
    newPrice: decimalToNumber(change.newPrice),
    oldOriginalPrice: decimalToNumber(change.oldOriginalPrice),
    newOriginalPrice: decimalToNumber(change.newOriginalPrice),
    currency: change.currency,
    oldAvailability: change.oldAvailability,
    newAvailability: change.newAvailability,
  }));
}

export async function countActiveEbayOffers(): Promise<number> {
  return prisma.affiliateLink.count({
    where: { isActive: true, marketplace: { code: "EBAY" } },
  });
}

export async function startPriceSyncRun(input: {
  trigger: "MANUAL" | "CRON";
  createdById?: string | null;
}): Promise<PriceSyncRunSummary> {
  const active = await getActivePriceSyncRun();
  if (active) {
    throw new PriceSyncError("A price sync is already running. Wait for it to finish.");
  }

  const offerIds = await listEbayOfferIdsForSync();
  const run = await prisma.priceSyncRun.create({
    data: {
      trigger: input.trigger,
      status: offerIds.length === 0 ? "COMPLETED" : "PENDING",
      offerIds,
      totalOffers: offerIds.length,
      createdById: input.createdById ?? null,
      startedAt: new Date(),
      finishedAt: offerIds.length === 0 ? new Date() : null,
    },
  });

  return toRunSummary(run);
}

export async function processPriceSyncBatch(
  runId: string,
  batchSize = PRICE_SYNC_BATCH_SIZE,
): Promise<PriceSyncRunSummary> {
  const run = await prisma.priceSyncRun.findUnique({ where: { id: runId } });
  if (!run) {
    throw new PriceSyncError("Price sync run not found.");
  }
  if (run.status === "COMPLETED" || run.status === "FAILED") {
    return toRunSummary(run);
  }

  if (run.status === "PENDING") {
    await prisma.priceSyncRun.update({
      where: { id: runId },
      data: { status: "RUNNING", startedAt: run.startedAt ?? new Date() },
    });
  }

  const start = run.processedOffers;
  const batchIds = run.offerIds.slice(start, start + batchSize);
  if (batchIds.length === 0) {
    const finished = await prisma.priceSyncRun.update({
      where: { id: runId },
      data: { status: "COMPLETED", finishedAt: new Date() },
    });
    return toRunSummary(finished);
  }

  let changedDelta = 0;
  let failedDelta = 0;
  let unchangedDelta = 0;
  const touchedSlugs = new Set<string>();

  for (const offerId of batchIds) {
    const before = await prisma.affiliateLink.findUnique({
      where: { id: offerId },
      include: {
        marketplace: { select: { code: true } },
        product: { select: { id: true, title: true, slug: true } },
      },
    });

    if (!before || before.marketplace.code !== "EBAY") {
      failedDelta += 1;
      continue;
    }

    const oldPrice = decimalToNumber(before.lastKnownPrice);
    const oldOriginalPrice = decimalToNumber(before.lastKnownOriginalPrice);
    const oldAvailability = before.lastKnownAvailability;

    try {
      const after = await refreshEbayOffer(offerId);
      const newPrice = decimalToNumber(after.lastKnownPrice);
      const newOriginalPrice = decimalToNumber(after.lastKnownOriginalPrice);
      const newAvailability = after.lastKnownAvailability;
      touchedSlugs.add(before.product.slug);

      const priceChanged = !pricesEqual(oldPrice, newPrice) || !pricesEqual(oldOriginalPrice, newOriginalPrice);

      if (priceChanged) {
        await prisma.priceSyncChange.create({
          data: {
            runId,
            affiliateLinkId: offerId,
            productId: before.product.id,
            productTitle: before.product.title,
            productSlug: before.product.slug,
            marketplaceCode: before.marketplace.code,
            externalProductId: before.externalProductId,
            oldPrice,
            newPrice,
            oldOriginalPrice,
            newOriginalPrice,
            currency: after.lastKnownPriceCurrency ?? before.lastKnownPriceCurrency,
            oldAvailability,
            newAvailability,
          },
        });
        changedDelta += 1;
      } else {
        unchangedDelta += 1;
      }
    } catch {
      failedDelta += 1;
    }
  }

  const processedOffers = start + batchIds.length;
  const isDone = processedOffers >= run.offerIds.length;

  const updated = await prisma.priceSyncRun.update({
    where: { id: runId },
    data: {
      processedOffers,
      changedOffers: { increment: changedDelta },
      failedOffers: { increment: failedDelta },
      unchangedOffers: { increment: unchangedDelta },
      status: isDone ? "COMPLETED" : "RUNNING",
      finishedAt: isDone ? new Date() : null,
      errorMessage: null,
    },
  });

  if (touchedSlugs.size > 0) {
    revalidatePublicCatalog();
    for (const slug of touchedSlugs) {
      revalidateProductPage(slug);
    }
  }

  return toRunSummary(updated);
}

/** Cron helper: start a run if needed, then process batches until done or maxBatches. */
export async function runCronPriceSync(options?: {
  batchSize?: number;
  maxBatches?: number;
}): Promise<{ run: PriceSyncRunSummary; batchesProcessed: number }> {
  const batchSize = options?.batchSize ?? PRICE_SYNC_BATCH_SIZE;
  const maxBatches = options?.maxBatches ?? 40;

  let run = await getActivePriceSyncRun();
  if (!run) {
    run = await startPriceSyncRun({ trigger: "CRON" });
  } else if (run.trigger !== "CRON") {
    // Do not steal a manual admin sync; report current active run.
    return { run, batchesProcessed: 0 };
  }

  let batchesProcessed = 0;
  while (run.isActive && batchesProcessed < maxBatches) {
    run = await processPriceSyncBatch(run.id, batchSize);
    batchesProcessed += 1;
    if (!run.isActive) break;
  }

  return { run, batchesProcessed };
}
