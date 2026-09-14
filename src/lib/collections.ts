export const PRODUCT_COLLECTIONS = {
  trending: {
    key: "trending",
    title: "Trending Products",
    shortTitle: "Trending",
    eyebrow: "Right now",
    description: "What's catching people's attention right now.",
    href: "/products?trending=1",
  },
  bestsellers: {
    key: "bestsellers",
    title: "Best Sellers",
    shortTitle: "Best Sellers",
    eyebrow: "Most loved",
    description: "Popular for a reason.",
    href: "/products?bestsellers=1",
  },
  featured: {
    key: "featured",
    title: "Editor's Picks",
    shortTitle: "Best Picks",
    eyebrow: "The shortlist",
    description: "Products we'd actually recommend to a friend.",
    href: "/products?featured=1",
  },
  newest: {
    key: "newest",
    title: "New & Interesting",
    shortTitle: "New",
    eyebrow: "Just landed",
    description: "Fresh finds worth discovering before everyone else.",
    href: "/products?new=1",
  },
  under50: {
    key: "under50",
    title: "Products Under $50",
    shortTitle: "Under $50",
    eyebrow: "Smart spend",
    description: "Good finds without the big price tag.",
    href: "/products?maxPrice=50",
  },
  under100: {
    key: "under100",
    title: "Products Under $100",
    shortTitle: "Under $100",
    eyebrow: "High value",
    description: "More value without going overboard.",
    href: "/products?maxPrice=100",
  },
} as const;

export type ProductCollectionKey = keyof typeof PRODUCT_COLLECTIONS;

export const NAV_LINKS = [
  { href: "/products", label: "Discover" },
  { href: "/categories", label: "Categories" },
  { href: PRODUCT_COLLECTIONS.trending.href, label: "Trending" },
  { href: PRODUCT_COLLECTIONS.featured.href, label: "Best Picks" },
] as const;

export interface ProductListingFilters {
  query?: string;
  categorySlug?: string;
  featured?: boolean;
  trending?: boolean;
  bestsellers?: boolean;
  newest?: boolean;
  maxPrice?: number;
}

export function listingCopy(filters: ProductListingFilters, categoryName?: string): {
  title: string;
  description: string;
} {
  if (filters.query) {
    return {
      title: `Results for “${filters.query}”`,
      description: "Products that match what you're looking for.",
    };
  }

  if (filters.trending) {
    return {
      title: PRODUCT_COLLECTIONS.trending.title,
      description: PRODUCT_COLLECTIONS.trending.description,
    };
  }

  if (filters.featured) {
    return {
      title: PRODUCT_COLLECTIONS.featured.title,
      description: PRODUCT_COLLECTIONS.featured.description,
    };
  }

  if (filters.bestsellers) {
    return {
      title: PRODUCT_COLLECTIONS.bestsellers.title,
      description: PRODUCT_COLLECTIONS.bestsellers.description,
    };
  }

  if (filters.newest) {
    return {
      title: PRODUCT_COLLECTIONS.newest.title,
      description: PRODUCT_COLLECTIONS.newest.description,
    };
  }

  if (filters.maxPrice === 50) {
    return {
      title: PRODUCT_COLLECTIONS.under50.title,
      description: PRODUCT_COLLECTIONS.under50.description,
    };
  }

  if (filters.maxPrice === 100) {
    return {
      title: PRODUCT_COLLECTIONS.under100.title,
      description: PRODUCT_COLLECTIONS.under100.description,
    };
  }

  if (categoryName) {
    return {
      title: categoryName,
      description: "Finds from this aisle that earned a spot on our radar.",
    };
  }

  return {
    title: "Discover products",
    description: "Browse the full RadarCut catalog — products worth finding.",
  };
}
