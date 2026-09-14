import type { ProductSummary } from "@/types/catalog";

/**
 * Pick up to `limit` products, preferring ones not already shown on the
 * homepage. Set `fillWithReuse` when overlap is logically appropriate
 * (for example price collections) and the unique pool is too small.
 */
export function takeUniqueProducts(
  pool: ProductSummary[],
  used: Set<string>,
  limit: number,
  options: { fillWithReuse?: boolean } = {},
): ProductSummary[] {
  const picked: ProductSummary[] = [];
  const pickedIds = new Set<string>();

  for (const product of pool) {
    if (picked.length >= limit) break;
    if (used.has(product.id)) continue;
    picked.push(product);
    pickedIds.add(product.id);
  }

  if (options.fillWithReuse && picked.length < limit) {
    for (const product of pool) {
      if (picked.length >= limit) break;
      if (pickedIds.has(product.id)) continue;
      picked.push(product);
      pickedIds.add(product.id);
    }
  }

  for (const product of picked) {
    used.add(product.id);
  }

  return picked;
}

export function pickUniqueProducts(limit: number, ...groups: ProductSummary[][]): ProductSummary[] {
  const seen = new Set<string>();
  const picked: ProductSummary[] = [];

  for (const group of groups) {
    for (const product of group) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      picked.push(product);
      if (picked.length >= limit) return picked;
    }
  }

  return picked;
}

/** Spread products across homepage rails so a small catalog still feels varied. */
export function composeHomepageCollections(pools: {
  trending: ProductSummary[];
  featured: ProductSummary[];
  bestsellers: ProductSummary[];
  newest: ProductSummary[];
  under50: ProductSummary[];
  under100: ProductSummary[];
}) {
  const used = new Set<string>();

  const trending = takeUniqueProducts(pools.trending, used, 2);
  const featured = takeUniqueProducts(pools.featured, used, 2);
  const bestsellers = takeUniqueProducts(pools.bestsellers, used, 2);
  const newest = takeUniqueProducts(pools.newest, used, 2);

  trending.push(...takeUniqueProducts(pools.trending, used, 2));
  featured.push(...takeUniqueProducts(pools.featured, used, 2));
  bestsellers.push(...takeUniqueProducts(pools.bestsellers, used, 2));
  newest.push(...takeUniqueProducts(pools.newest, used, 2));

  return {
    trending,
    featured,
    bestsellers,
    newest,
    under50: takeUniqueProducts(pools.under50, used, 4, { fillWithReuse: true }),
    under100: takeUniqueProducts(pools.under100, used, 4, { fillWithReuse: true }),
  };
}
