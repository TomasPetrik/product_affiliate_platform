export interface CampaignParams {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
}

export interface AttributionPair {
  first: CampaignParams;
  last: CampaignParams;
}

function clean(value: string | null | undefined, max = 200): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function cleanCampaignParams(input: Partial<CampaignParams> | null | undefined): CampaignParams {
  return {
    source: clean(input?.source),
    medium: clean(input?.medium),
    campaign: clean(input?.campaign),
    content: clean(input?.content),
    term: clean(input?.term),
  };
}

export function hasCampaignParams(params: CampaignParams): boolean {
  return Boolean(params.source || params.medium || params.campaign || params.content || params.term);
}

/**
 * Merge incoming UTMs into session first/last touch.
 * First-touch is sticky. Last-touch updates whenever new campaign params arrive.
 */
export function mergeAttribution(
  existingFirst: CampaignParams,
  existingLast: CampaignParams,
  incoming: CampaignParams,
): AttributionPair {
  const next = cleanCampaignParams(incoming);
  const first = cleanCampaignParams(existingFirst);
  const last = cleanCampaignParams(existingLast);

  if (!hasCampaignParams(next)) {
    return {
      first: hasCampaignParams(first) ? first : last,
      last: hasCampaignParams(last) ? last : first,
    };
  }

  return {
    first: hasCampaignParams(first) ? first : next,
    last: next,
  };
}

export function ctr(clicks: number, views: number): number | null {
  if (views <= 0) return null;
  if (clicks <= 0) return 0;
  return (clicks / views) * 100;
}

export function formatCtr(value: number | null, digits = 1): string {
  if (value === null) return "—";
  return `${value.toFixed(digits)}%`;
}
