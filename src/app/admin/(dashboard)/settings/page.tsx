import type { Metadata } from "next";
import Link from "next/link";

import { AmazonOfferSettingsCard } from "@/components/admin/amazon-offer-settings-card";
import { MetaConnectionCard } from "@/components/admin/meta-connection-card";
import { TikTokAccountConnectionCard } from "@/components/admin/tiktok-account-connection-card";
import { TikTokAdsConnectionCard } from "@/components/admin/tiktok-ads-connection-card";
import { TikTokConnectionCard } from "@/components/admin/tiktok-connection-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { getMetaRedirectUri } from "@/lib/meta";
import { prisma } from "@/lib/prisma";
import { getTikTokAccountRedirectUri } from "@/lib/tiktok-account";
import { getTikTokAdsRedirectUri } from "@/lib/tiktok-ads";
import { getTikTokRedirectUri } from "@/lib/tiktok";
import { getMetaConnectionPublic } from "@/server/services/meta-oauth.service";
import { listCachedMetaMedia } from "@/server/services/meta-media.service";
import { getSiteSettings } from "@/server/services/site-settings.service";
import { getTikTokAccountConnectionPublic } from "@/server/services/tiktok-account-oauth.service";
import { getTikTokAdsConnectionPublic } from "@/server/services/tiktok-ads-oauth.service";
import { getTikTokConnectionPublic } from "@/server/services/tiktok-oauth.service";
import { listCachedTikTokVideos } from "@/server/services/tiktok-video.service";
import {
  listRecentCommentAutoReplyLogs,
  listRecentMetaWebhookEvents,
} from "@/server/services/meta-webhook-events.service";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tiktok?: string;
    tiktok_ads?: string;
    tiktok_account?: string;
    meta?: string;
  }>;
}) {
  const session = await getAdminSession();
  const params = await searchParams;
  const [
    productCount,
    categoryCount,
    marketplaceCount,
    revenueCount,
    tiktok,
    cachedVideos,
    tiktokAds,
    tiktokAccount,
    meta,
    cachedMetaMedia,
    siteSettings,
    webhookEvents,
    autoReplyLogs,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.category.count(),
    prisma.marketplace.count(),
    prisma.revenueEntry.count(),
    getTikTokConnectionPublic(),
    listCachedTikTokVideos(40),
    getTikTokAdsConnectionPublic(),
    getTikTokAccountConnectionPublic(),
    getMetaConnectionPublic(),
    listCachedMetaMedia(40),
    getSiteSettings(),
    listRecentMetaWebhookEvents(15),
    listRecentCommentAutoReplyLogs(15),
  ]);

  const connectedLabel =
    tiktok.connectedLabel ?? (tiktok.displayName ? tiktok.displayName : null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Site identity, signed-in admin, marketplace and social connections.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Signed-in admin</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span> {session?.name || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Email:</span> {session?.email || "—"}
            </p>
            <p className="flex items-center gap-2">
              <span className="text-muted-foreground">Role:</span>
              <Badge variant="secondary">{session?.role}</Badge>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Site</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p>
              <span className="text-muted-foreground">Public URL:</span> {env.NEXT_PUBLIC_SITE_URL}
            </p>
            <p>
              <span className="text-muted-foreground">Environment:</span> {env.NODE_ENV}
            </p>
            <p className="text-muted-foreground">
              {productCount} products · {categoryCount} categories · {marketplaceCount} marketplaces
            </p>
          </CardContent>
        </Card>

        <AmazonOfferSettingsCard
          preferAmazonWhenCheapest={siteSettings.preferAmazonWhenCheapest}
          forceAmazonOnly={siteSettings.forceAmazonOnly}
        />

        <MetaConnectionCard
          oauthConfigured={meta.oauthConfigured}
          loginConfigConfigured={Boolean(env.META_LOGIN_CONFIG_ID)}
          connected={meta.connected}
          status={meta.status}
          connectedLabel={meta.connectedLabel}
          pageName={meta.pageName}
          pageId={meta.pageId}
          instagramUsername={meta.instagramUsername}
          instagramBusinessAccountId={meta.instagramBusinessAccountId}
          lastSyncedAt={meta.lastSyncedAt?.toISOString() ?? null}
          lastError={meta.lastError}
          redirectUri={getMetaRedirectUri()}
          flash={params.meta ?? null}
          media={cachedMetaMedia.map((item) => ({
            id: item.id,
            platform: item.platform,
            externalId: item.externalId,
            title: item.title,
            permalinkUrl: item.permalinkUrl,
            viewCount: item.viewCount.toString(),
          }))}
          webhookEvents={webhookEvents.map((event) => ({
            id: event.id,
            createdAt: event.createdAt.toISOString(),
            object: event.object,
            fields: event.fields,
            summary: event.summary,
            commentEventCount: event.commentEventCount,
            signatureOk: event.signatureOk,
          }))}
          autoReplyLogs={autoReplyLogs.map((log) => ({
            id: log.id,
            createdAt: log.createdAt.toISOString(),
            platform: log.platform,
            status: log.status,
            commentText: log.commentText,
            productTitle: log.product.title,
            keyword: log.rule?.keyword ?? null,
            errorMessage: log.errorMessage,
          }))}
        />

        <TikTokConnectionCard
          oauthConfigured={tiktok.oauthConfigured}
          connected={tiktok.connected}
          status={tiktok.status}
          connectedLabel={
            connectedLabel
              ? connectedLabel.startsWith("@")
                ? connectedLabel
                : tiktok.username
                  ? `@${tiktok.username}`
                  : connectedLabel
              : null
          }
          displayName={tiktok.displayName}
          lastSyncedAt={tiktok.lastSyncedAt?.toISOString() ?? null}
          lastError={tiktok.lastError}
          redirectUri={getTikTokRedirectUri()}
          flash={params.tiktok ?? null}
          videos={cachedVideos.map((video) => ({
            id: video.id,
            title: video.title,
            shareUrl: video.shareUrl,
            viewCount: video.viewCount.toString(),
            createTime: video.createTime?.toISOString() ?? null,
          }))}
        />

        <TikTokAdsConnectionCard
          oauthConfigured={tiktokAds.oauthConfigured}
          connected={tiktokAds.connected}
          status={tiktokAds.status}
          connectedLabel={tiktokAds.connectedLabel}
          advertiserIds={tiktokAds.advertiserIds}
          lastError={tiktokAds.lastError}
          redirectUri={getTikTokAdsRedirectUri()}
          flash={params.tiktok_ads ?? null}
        />

        <TikTokAccountConnectionCard
          oauthConfigured={tiktokAccount.oauthConfigured}
          connected={tiktokAccount.connected}
          status={tiktokAccount.status}
          connectedLabel={tiktokAccount.connectedLabel}
          openId={tiktokAccount.openId}
          lastError={tiktokAccount.lastError}
          redirectUri={getTikTokAccountRedirectUri()}
          flash={params.tiktok_account ?? null}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Marketplaces</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p className="text-muted-foreground">
              Amazon and eBay destinations are managed on the marketplaces page. Import jobs stay
              deferred until a retailer API is connected.
            </p>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/admin/marketplaces" />}>
              Open marketplaces
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Revenue imports</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p className="text-muted-foreground">
              Affiliate networks often do not expose order-level data. A revenue import table is
              ready for later manual commission uploads. Attribution is not calculated yet.
            </p>
            <p className="text-muted-foreground">{revenueCount} imported rows on file.</p>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/admin/revenue" />}>
              Open revenue
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
