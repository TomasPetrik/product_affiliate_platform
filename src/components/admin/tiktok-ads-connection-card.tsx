"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  disconnectTikTokAdsAction,
  type TikTokAdsActionState,
} from "@/server/actions/tiktok-ads.actions";

export interface TikTokAdsConnectionCardProps {
  oauthConfigured: boolean;
  connected: boolean;
  status: string;
  connectedLabel: string | null;
  advertiserIds: string[];
  lastError: string | null;
  redirectUri: string;
  flash?: string | null;
}

const initialState: TikTokAdsActionState = {};

function flashMessage(flash: string | null | undefined): { tone: "ok" | "error"; text: string } | null {
  if (!flash) return null;
  switch (flash) {
    case "connected":
      return { tone: "ok", text: "TikTok Ads connected successfully." };
    case "access_denied":
      return { tone: "error", text: "TikTok Ads authorization was denied." };
    case "invalid_state":
      return { tone: "error", text: "OAuth state mismatch. Try Connect TikTok Ads again." };
    case "missing_code":
      return { tone: "error", text: "TikTok Ads callback was missing an authorization code." };
    case "missing_credentials":
      return {
        tone: "error",
        text: "Set TIKTOK_ADS_APP_ID and TIKTOK_ADS_APP_SECRET on the server, then try again.",
      };
    case "token_exchange_failed":
      return { tone: "error", text: "Could not exchange the TikTok Ads auth_code for an access token." };
    case "oauth_error":
      return { tone: "error", text: "TikTok Ads returned an OAuth error. Try connecting again." };
    default:
      return { tone: "error", text: `TikTok Ads OAuth: ${flash}` };
  }
}

export function TikTokAdsConnectionCard(props: TikTokAdsConnectionCardProps) {
  const [disconnectState, disconnectAction, disconnectPending] = useActionState(
    disconnectTikTokAdsAction,
    initialState,
  );
  const flash = flashMessage(props.flash);
  const needsReauth = props.status === "NEEDS_REAUTH";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-sm">TikTok Ads</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Marketing API advertiser OAuth (TikTok API for Business). Separate from Login Kit video
            sync above.
          </p>
        </div>
        {props.connected ? (
          <Badge variant="secondary">Connected</Badge>
        ) : needsReauth ? (
          <Badge variant="destructive">Reconnect required</Badge>
        ) : (
          <Badge variant="outline">Not connected</Badge>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        {flash ? (
          <Alert variant={flash.tone === "error" ? "destructive" : "default"}>
            <AlertDescription>{flash.text}</AlertDescription>
          </Alert>
        ) : null}
        {disconnectState.error ? (
          <Alert variant="destructive">
            <AlertDescription>{disconnectState.error}</AlertDescription>
          </Alert>
        ) : null}
        {disconnectState.ok && disconnectState.message ? (
          <Alert>
            <AlertDescription>{disconnectState.message}</AlertDescription>
          </Alert>
        ) : null}

        {!props.oauthConfigured ? (
          <p className="text-xs text-muted-foreground">
            Add <code className="text-xs">TIKTOK_ADS_APP_ID</code> and{" "}
            <code className="text-xs">TIKTOK_ADS_APP_SECRET</code> to the server environment, then
            reconnect.
          </p>
        ) : props.connected || needsReauth ? (
          <div className="grid gap-3">
            <p>
              <span className="text-muted-foreground">Status:</span>{" "}
              {needsReauth ? "Reconnect TikTok Ads" : "Connected"}
              {props.connectedLabel ? (
                <>
                  {" "}
                  · <span className="font-medium">{props.connectedLabel}</span>
                </>
              ) : null}
            </p>
            {props.advertiserIds.length ? (
              <p className="text-xs text-muted-foreground">
                Advertiser IDs: {props.advertiserIds.join(", ")}
              </p>
            ) : null}
            {props.lastError ? (
              <Alert variant="destructive">
                <AlertDescription>{props.lastError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" nativeButton={false} render={<a href="/api/tiktok/oauth/auth" />}>
                {needsReauth ? "Reconnect TikTok Ads" : "Reconnect"}
              </Button>
              <form action={disconnectAction}>
                <Button size="sm" variant="outline" type="submit" disabled={disconnectPending}>
                  Disconnect
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <p className="text-muted-foreground">
              Authorize RadarCut&apos;s TikTok Ads advertiser account so Admin can call the Marketing
              API with a long-lived access token.
            </p>
            <Button size="sm" nativeButton={false} render={<a href="/api/tiktok/oauth/auth" />}>
              Connect TikTok Ads
            </Button>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Advertiser redirect URL in TikTok API for Business must be exactly:{" "}
          <code className="break-all">{props.redirectUri}</code>
        </p>
      </CardContent>
    </Card>
  );
}
