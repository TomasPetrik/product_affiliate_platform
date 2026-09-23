import Link from "next/link";
import { ArrowDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SOCIAL_PLATFORM_LABELS } from "@/lib/social-external-id";
import type { ProductMarketingFunnel } from "@/server/services/marketing-video.service";

interface MarketingFunnelCardProps {
  funnel: ProductMarketingFunnel;
  editHref: string;
}

function rate(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function Step({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border px-3 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function MarketingFunnelCard({ funnel, editHref }: MarketingFunnelCardProps) {
  if (funnel.videos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Video views funnel</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No marketing videos linked yet.{" "}
          <Link href={editHref} className="underline underline-offset-2">
            Add Instagram / Facebook / YouTube / TikTok posts
          </Link>{" "}
          on the product edit page.
        </CardContent>
      </Card>
    );
  }

  const { totals } = funnel;
  const rangeLabel =
    totals.rangeViews != null
      ? totals.rangeViews.toLocaleString()
      : "— (need daily sync history)";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Video views funnel</CardTitle>
        <p className="text-xs text-muted-foreground">
          Platform views come from each network API. Range views need at least two daily syncs
          bracketing the selected dates. Site steps use first-party analytics
          {funnel.videos.some((v) => v.utmCampaign)
            ? " (filtered by each video’s utm_campaign when set)."
            : "."}
        </p>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-2">
          <Step
            label="1 · Video views (selected range)"
            value={rangeLabel}
            hint={`Lifetime across platforms: ${totals.lifetimeViews.toLocaleString()}`}
          />
          <div className="flex justify-center text-muted-foreground">
            <ArrowDown className="h-4 w-4" />
          </div>
          <Step
            label="2 · Site sessions"
            value={totals.siteSessions.toLocaleString()}
            hint={`View → site: ${rate(totals.siteSessions, totals.rangeViews ?? 0)}`}
          />
          <div className="flex justify-center text-muted-foreground">
            <ArrowDown className="h-4 w-4" />
          </div>
          <Step
            label="3 · Product views"
            value={totals.productViews.toLocaleString()}
            hint={`Session → product view: ${rate(totals.productViews, totals.siteSessions)}`}
          />
          <div className="flex justify-center text-muted-foreground">
            <ArrowDown className="h-4 w-4" />
          </div>
          <Step
            label="4 · Affiliate clicks"
            value={totals.affiliateClicks.toLocaleString()}
            hint={`Product view → click: ${rate(totals.affiliateClicks, totals.productViews)}`}
          />
        </div>

        <div className="grid gap-3">
          <p className="text-xs font-medium text-muted-foreground">By platform / video</p>
          {funnel.videos.map((video) => (
            <div key={video.id} className="rounded-md border px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{video.title || "Untitled video"}</p>
                {video.utmCampaign ? (
                  <Badge variant="secondary">utm_campaign={video.utmCampaign}</Badge>
                ) : null}
              </div>
              <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                {video.platforms.map((post) => (
                  <li key={`${video.id}-${post.platform}`} className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {SOCIAL_PLATFORM_LABELS[post.platform]}
                    </span>
                    : {(post.rangeViews ?? post.lifetimeViews).toLocaleString()}
                    {post.rangeViews == null ? " lifetime" : " in range"}
                    {post.syncStatus === "ERROR" ? (
                      <span className="text-destructive"> · sync error</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
