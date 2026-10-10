"use server";

import { requireAdminSession } from "@/lib/auth";
import { WAN_IMAGE_EDIT_PRO_MODEL } from "@/lib/wan-image-edit";
import { WAN_REFERENCE_TO_VIDEO_MODEL } from "@/lib/wan-video";
import { WAN_VIDEO_EDIT_MODEL } from "@/lib/wan-video-edit";
import {
  estimateWaveSpeedPrice,
  isWaveSpeedConfigured,
} from "@/server/services/wavespeed.client";

export type WanCostEstimateKind =
  | "image-edit"
  | "reference-to-video"
  | "video-edit";

export interface EstimateWanGenerationCostInput {
  kind: WanCostEstimateKind;
  /** Image edit: `width*height`. */
  size?: string;
  /** Video models: output duration seconds; omit for auto. */
  duration?: number | null;
  resolution?: string;
  aspectRatio?: string;
  generateAudio?: boolean;
  enablePromptExpansion?: boolean;
}

export interface EstimateWanGenerationCostState {
  error?: string;
  /** Payable USD after account discount. */
  costUsd?: number;
  /** List price USD before discount. */
  listPriceUsd?: number;
  currency?: string;
}

function buildPriceInputs(
  input: EstimateWanGenerationCostInput,
): { modelId: string; inputs: Record<string, unknown> } {
  if (input.kind === "image-edit") {
    const inputs: Record<string, unknown> = {};
    if (input.size?.trim()) inputs.size = input.size.trim();
    return { modelId: WAN_IMAGE_EDIT_PRO_MODEL, inputs };
  }

  if (input.kind === "reference-to-video") {
    const inputs: Record<string, unknown> = {};
    if (input.duration != null && Number.isFinite(input.duration)) {
      inputs.duration = input.duration;
    }
    if (input.resolution?.trim()) inputs.resolution = input.resolution.trim();
    if (input.aspectRatio?.trim()) inputs.aspect_ratio = input.aspectRatio.trim();
    if (input.generateAudio !== undefined) {
      inputs.generate_audio = input.generateAudio;
    }
    if (input.enablePromptExpansion !== undefined) {
      inputs.enable_prompt_expansion = input.enablePromptExpansion;
    }
    return { modelId: WAN_REFERENCE_TO_VIDEO_MODEL, inputs };
  }

  const inputs: Record<string, unknown> = {};
  if (input.duration != null && Number.isFinite(input.duration)) {
    inputs.duration = input.duration;
  }
  if (input.resolution?.trim()) inputs.resolution = input.resolution.trim();
  if (input.generateAudio !== undefined) {
    inputs.generate_audio = input.generateAudio;
  }
  if (input.enablePromptExpansion !== undefined) {
    inputs.enable_prompt_expansion = input.enablePromptExpansion;
  }
  return { modelId: WAN_VIDEO_EDIT_MODEL, inputs };
}

/** Quote WaveSpeed cost for the current form setup (before submit). */
export async function estimateWanGenerationCostAction(
  input: EstimateWanGenerationCostInput,
): Promise<EstimateWanGenerationCostState> {
  await requireAdminSession();

  if (!isWaveSpeedConfigured()) {
    return { error: "WAVESPEED_API_KEY is not configured." };
  }

  const { modelId, inputs } = buildPriceInputs(input);
  const quote = await estimateWaveSpeedPrice({
    modelId,
    inputs,
  });

  if (!quote) {
    // Fall back to base price without inputs.
    const base = await estimateWaveSpeedPrice({ modelId });
    if (!base) {
      return { error: "Could not estimate price for this setup." };
    }
    return {
      costUsd: base.discountedPrice,
      listPriceUsd: base.price,
      currency: base.currency,
    };
  }

  return {
    costUsd: quote.discountedPrice,
    listPriceUsd: quote.price,
    currency: quote.currency,
  };
}
