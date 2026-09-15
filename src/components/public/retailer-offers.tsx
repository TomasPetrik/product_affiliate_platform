import { AffiliateCtaButton } from "@/components/public/affiliate-cta-button";
import { formatCurrency } from "@/lib/format";
import type { MarketplaceLink } from "@/types/catalog";

interface RetailerOffersProps {
  offers: MarketplaceLink[];
}

/**
 * Dynamic "where to buy" list. Renders whatever retailer offers are stored
 * for the product — eBay today, Amazon/Walmart later — without hardcoding
 * retailer-specific UI.
 */
export function RetailerOffers({ offers }: RetailerOffersProps) {
  if (offers.length === 0) {
    return <p className="text-sm text-muted-foreground">No retailer offers yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {offers.map((offer, index) => (
        <li
          key={offer.id}
          className="flex flex-col gap-3 rounded-[14px] border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-sm font-semibold">{offer.label}</p>
            {offer.price != null && offer.currency ? (
              <p className="text-price text-lg tracking-tight">{formatCurrency(offer.price, offer.currency)}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Price on {offer.label}</p>
            )}
          </div>
          <AffiliateCtaButton
            link={offer}
            variant={index === 0 ? "default" : "outline"}
            label="Check Price"
          />
        </li>
      ))}
    </ul>
  );
}
