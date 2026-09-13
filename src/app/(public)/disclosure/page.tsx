import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate disclosure",
  description: "How FindIt earns money and why we recommend the products we do.",
};

export default function DisclosurePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Affiliate disclosure</h1>

      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          FindIt is a product discovery and review site. We do not sell products, and we never
          process payments ourselves — every purchase you make happens directly on the marketplace
          (for example Amazon or eBay), under that marketplace&apos;s own terms.
        </p>
        <p className="font-medium text-foreground">
          As an Amazon Associate we earn from qualifying purchases. We are also a member of the eBay
          Partner Network and other affiliate programs.
        </p>
        <p>
          This means that when you click a &quot;View on Amazon&quot;, &quot;View on eBay&quot; or
          similar button on this site and go on to make a purchase, we may earn a small commission.
          This comes at no additional cost to you — the price you pay is the same as if you had
          navigated to the marketplace directly.
        </p>
        <p>
          Our recommendations are based on independent research, publicly available product data and
          customer ratings. Affiliate relationships do not influence which products we choose to
          feature, but they are how this site sustains itself.
        </p>
        <p>
          Prices and availability shown on FindIt are reference information only and may not reflect
          the current price on the marketplace. Always confirm the final price and availability on
          the retailer&apos;s site before purchasing.
        </p>
      </div>
    </div>
  );
}
