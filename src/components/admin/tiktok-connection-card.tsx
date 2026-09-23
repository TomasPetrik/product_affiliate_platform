"use client";

import { useActionState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  disconnectTikTokAction,
  syncTikTokVideosAction,
  type TikTokActionState,
} from "@/server/actions/tiktok.actions";

export interface TikTokConnectionCardProps {
  oauthConfigured: boolean;
  connected: boolean;
  status: string;
  connectedLabel: string | null;
  displayName: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  redirectUri: string;
  flash?: string | null;
  videos: Array<{
    id: string;
    title: string | null;
    shareUrl: string | null;
    viewCount: string;
    createTime: string | null;
  }>;
}

const initialState: TikTokActionState = {};

function flashMessage(flash: string | null | undefined): { tone: "ok" | "error"; text: string } | null {
  if (!flash) return null;
  switch (flash) {
    case "connected":
      return { tone: "ok", text: "TikTok connected successfully." };
    case "access_denied":
      return { tone: "error", text: "TikTok authorization was denied." };
    case "invalid_scope":
      return { tone: "error", text: "TikTok rejected the requested scopes." };
    case "invalid_state":
      return { tone: "error", text: "OAuth state mismatch. Try Connect TikTok again." };
    case "missing_code":
      return { tone: "error", text: "TikTok callback was missing an authorization code." };
    case "missing_credentials":
      return {
        tone: "error",
        text: "Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET on the server, then try again.",
      };
    case "token_exchange_failed":
      return { tone: "error", text: "Could not exchange the TikTok authorization code for tokens." };
    case "oauth_error":
      return { tone: "error", text: "TikTok returned an OAuth error. Try connecting again." };
    default:
      return { tone: "error", text: `TikTok OAuth: ${flash}` };
  }
}

export function TikTokConnectionCard(props: TikTokConnectionCardProps) {
  const [disconnectState, disconnectAction, disconnectPending] = useActionState(
    disconnectTikTokAction,
    initialState,
  );
  const [syncState, syncAction, syncPending] = useActionState(syncTikTokVideosAction, initialState);
  const flash = flashMessage(props.flash);
  const needsReauth = props.status === "NEEDS_REAUTH";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-sm">TikTok</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Login Kit OAuth for Display API video.list / view counts (scopes: user.info.basic,
            video.list).
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
        {disconnectState.error || syncState.error ? (
          <Alert variant="destructive">
            <AlertDescription>{disconnectState.error || syncState.error}</AlertDescription>
          </Alert>
        ) : null}
        {(disconnectState.ok && disconnectState.message) || (syncState.ok && syncState.message) ? (
          <Alert>
            <AlertDescription>{disconnectState.message || syncState.message}</AlertDescription>
          </Alert>
        ) : null}

        {!props.oauthConfigured ? (
          <p className="text-muted-foreground">
            Add <code className="text-xs">TIKTOK_CLIENT_KEY</code> and{" "}
            <code className="text-xs">TIKTOK_CLIENT_SECRET</code> to the server environment, then
            restart the app.
          </p>
        ) : null}

        {props.connected || needsReauth ? (
          <div className="grid gap-1">
            <p className="font-medium text-foreground">
              {needsReauth ? "Reconnect TikTok" : "Connected"}
              {props.connectedLabel ? `: ${props.connectedLabel}` : props.displayName ? `: ${props.displayName}` : ""}
            </p>
            {props.lastSyncedAt ? (
              <p className="text-xs text-muted-foreground">
                Last video sync: {new Date(props.lastSyncedAt).toLocaleString()}
              </p>
            ) : null}
            {props.lastError ? <p className="text-xs text-destructive">{props.lastError}</p> : null}
          </div>
        ) : (
          <p className="text-muted-foreground">
            Connect the RadarCut TikTok account so Admin can list videos and sync view counts into
            marketing funnels.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {props.oauthConfigured && (!props.connected || needsReauth) ? (
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/api/tiktok/auth" />}
            >
              {needsReauth ? "Reconnect TikTok" : "Connect TikTok"}
            </Button>
          ) : null}

          {props.connected ? (
            <>
              <form action={syncAction}>
                <Button type="submit" variant="outline" size="sm" disabled={syncPending}>
                  <RefreshCw className={`h-3.5 w-3.5 ${syncPending ? "animate-spin" : ""}`} />
                  Sync TikTok Videos
                </Button>
              </form>
              <form action={disconnectAction}>
                <Button type="submit" variant="ghost" size="sm" disabled={disconnectPending}>
                  {disconnectPending ? "Disconnecting…" : "Disconnect"}
                </Button>
              </form>
            </>
          ) : null}
        </div>

        {props.videos.length > 0 ? (
          <div className="grid gap-2">
            <p className="text-xs font-medium text-foreground">Cached TikTok videos</p>
            <p className="text-xs text-muted-foreground">
              To associate a video with a product, open the product edit page and paste the TikTok
              URL or ID under Marketing video funnel. Sync updates view counts on already-linked
              posts without creating duplicates.
            </p>
            <ul className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-2">
              {props.videos.map((video) => (
                <li key={video.id} className="grid gap-0.5 border-b border-dashed pb-2 last:border-0 last:pb-0">
                  <p className="font-medium">{video.title || "Untitled video"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    ID {video.id} · {Number(video.viewCount).toLocaleString()} views
                  </p>
                  {video.shareUrl ? (
                    <a
                      href={video.shareUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-xs underline underline-offset-2"
                    >
                      {video.shareUrl}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : props.connected ? (
          <p className="text-xs text-muted-foreground">
            No cached videos yet. Click Sync TikTok Videos after connecting.
          </p>
        ) : null}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Redirect URI registered in TikTok Developer Portal must be exactly:{" "}
          <code className="break-all">{props.redirectUri}</code>
        </p>
      </CardContent>
    </Card>
  );
}
