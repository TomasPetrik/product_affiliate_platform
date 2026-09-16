"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  getActivePriceSyncRun,
  getPriceSyncRunById,
  PRICE_SYNC_BATCH_SIZE,
  PriceSyncError,
  processPriceSyncBatch,
  startPriceSyncRun,
  type PriceSyncRunSummary,
} from "@/server/services/price-sync.service";

export async function startManualPriceSyncAction(): Promise<
  { ok: true; run: PriceSyncRunSummary } | { ok: false; error: string }
> {
  const session = await requireAdminSession();

  try {
    const existing = await getActivePriceSyncRun();
    if (existing) {
      return { ok: true, run: existing };
    }

    const run = await startPriceSyncRun({
      trigger: "MANUAL",
      createdById: session.sub,
    });

    await writeAuditLog({
      actor: session,
      action: "PRICE_SYNC_STARTED",
      entityType: "PriceSyncRun",
      entityId: run.id,
      after: { trigger: "MANUAL", totalOffers: run.totalOffers },
    });

    revalidatePath("/admin/price-sync");
    return { ok: true, run };
  } catch (error) {
    const message = error instanceof PriceSyncError ? error.message : "Could not start price sync.";
    return { ok: false, error: message };
  }
}

export async function processPriceSyncBatchAction(
  runId: string,
): Promise<{ ok: true; run: PriceSyncRunSummary } | { ok: false; error: string }> {
  await requireAdminSession();

  try {
    const run = await processPriceSyncBatch(runId, PRICE_SYNC_BATCH_SIZE);
    if (!run.isActive) {
      revalidatePath("/admin/price-sync");
      revalidatePath(`/admin/price-sync/${run.id}`);
    }
    return { ok: true, run };
  } catch (error) {
    const message = error instanceof PriceSyncError ? error.message : "Price sync batch failed.";
    return { ok: false, error: message };
  }
}

export async function getPriceSyncRunStatusAction(
  runId: string,
): Promise<{ ok: true; run: PriceSyncRunSummary } | { ok: false; error: string }> {
  await requireAdminSession();
  const run = await getPriceSyncRunById(runId);
  if (!run) {
    return { ok: false, error: "Sync run not found." };
  }
  return { ok: true, run };
}
