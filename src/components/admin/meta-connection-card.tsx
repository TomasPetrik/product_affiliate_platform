"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  disconnectMetaAction,
  syncMetaMediaAction,
  type MetaActionState,
} from "@/server/actions/meta.actions";

export interface MetaConnectionCardProps {
  oauthConfigured: boolean;
  loginConfigConfigured: boolean;
  connected: boolean;
  status: string;
  connectedLabel: string | null;
  pageName: string | null;
  pageId: string | null;
  instagramUsername: string | null;
  instagramBusinessAccountId: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  redirectUri: string;
  flash?: string | null;
  media: Array<{
    id: string;
    platform: string;
    externalId: string;
    title: string | null;
    permalinkUrl: string | null;
    viewCount: string;
  }>;
  webhookEvents?: Array<{
    id: string;
    createdAt: string;
    object: string | null;
    fields: string | null;
    summary: string;
    commentEventCount: number;
    signatureOk: boolean;
  }>;
  autoReplyLogs?: Array<{
    id: string;
    createdAt: string;
    platform: string;
    status: string;
    commentText: string | null;
    productTitle: string | null;
    keyword: string | null;
    errorMessage: string | null;
  }>;
}

const initialState: MetaActionState = {};

function flashMessage(flash: string | null | undefined): { tone: "ok" | "error"; text: string } | null {
  if (!flash) return null;
  switch (flash) {
    case "connected":
      return { tone: "ok", text: "Meta connected successfully." };
    case "access_denied":
      return { tone: "error", text: "Meta authorization was denied." };
    case "invalid_state":
      return { tone: "error", text: "OAuth state mismatch. Try Connect Meta again." };
    case "missing_code":
      return { tone: "error", text: "Meta callback was missing an authorization code." };
    case "missing_credentials":
      return {
        tone: "error",
        text: "Set META_APP_ID and META_APP_SECRET on the server, then try again.",
      };
    case "token_exchange_failed":
      return {
        tone: "error",
        text: "Could not complete Meta OAuth (token exchange or Page/IG discovery failed).",
      };
    case "oauth_error":
      return { tone: "error", text: "Meta returned an OAuth error. Try connecting again." };
    default:
      return { tone: "error", text: `Meta OAuth: ${flash}` };
  }
}

export function MetaConnectionCard(props: MetaConnectionCardProps) {
  const [disconnectState, disconnectAction, disconnectPending] = useActionState(
    disconnectMetaAction,
    initialState,
  );
  const [syncState, syncAction, syncPending] = useActionState(syncMetaMediaAction, initialState);
  const flash = flashMessage(props.flash);
  const needsReauth = props.status === "NEEDS_REAUTH";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-sm">Meta (Facebook + Instagram)</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Facebook Login for Business for Page + Instagram media, views, and comment auto-replies.
            Login Config must include comment scopes; reconnect after adding them. Webhooks:
            callback <code className="text-xs">/api/meta/webhooks</code> with{" "}
            <code className="text-xs">META_WEBHOOK_VERIFY_TOKEN</code>.
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
            Add <code className="text-xs">META_APP_ID</code> and{" "}
            <code className="text-xs">META_APP_SECRET</code> to the server environment, then restart
            the app.
          </p>
        ) : null}

        {props.oauthConfigured && !props.loginConfigConfigured ? (
          <Alert variant="destructive">
            <AlertDescription>
              Meta rejected Page/Instagram scopes on plain Facebook Login (&quot;Invalid
              Scopes&quot;). Create a{" "}
              <strong>Facebook Login for Business</strong> configuration in Meta Developers that
              includes pages_show_list, pages_read_engagement, instagram_basic, and
              instagram_manage_insights, then set <code className="text-xs">META_LOGIN_CONFIG_ID</code>{" "}
              on the server and restart.
            </AlertDescription>
          </Alert>
        ) : null}

        {props.connected || needsReauth ? (
          <div className="grid gap-1">
            <p className="font-medium text-foreground">
              {needsReauth ? "Reconnect Meta" : "Connected"}
              {props.connectedLabel ? `: ${props.connectedLabel}` : ""}
            </p>
            {props.pageName ? (
              <p className="text-xs text-muted-foreground">
                Facebook Page: {props.pageName}
                {props.pageId ? ` (${props.pageId})` : ""}
              </p>
            ) : null}
            {props.instagramUsername || props.instagramBusinessAccountId ? (
              <p className="text-xs text-muted-foreground">
                Instagram:{" "}
                {props.instagramUsername
                  ? props.instagramUsername.startsWith("@")
                    ? props.instagramUsername
                    : `@${props.instagramUsername}`
                  : "linked"}
                {props.instagramBusinessAccountId
                  ? ` · ID ${props.instagramBusinessAccountId}`
                  : ""}
              </p>
            ) : (
              <p className="text-xs text-destructive">
                No Instagram Professional account was found on this Page. Link IG to the Page in
                Meta Business Suite, then reconnect.
              </p>
            )}
            {props.lastSyncedAt ? (
              <p className="text-xs text-muted-foreground">
                Last media sync: {new Date(props.lastSyncedAt).toLocaleString()}
              </p>
            ) : null}
            {props.lastError ? <p className="text-xs text-destructive">{props.lastError}</p> : null}
          </div>
        ) : (
          <p className="text-muted-foreground">
            Connect the Facebook account that admins the RadarCut Page so Admin can sync Instagram
            Reels and Facebook video view counts into marketing funnels.
          </p>
        )}

        {props.oauthConfigured && (!props.connected || needsReauth) && props.loginConfigConfigured ? (
          <p className="text-xs text-muted-foreground">
            If Connect Meta shows Facebook&apos;s generic error, try{" "}
            <strong>Connect (classic scopes)</strong>. If that fails with{" "}
            <code className="text-[10px]">pages_read_user_content</code>, add that permission under
            Use Cases → Manage everything on your Page, or use{" "}
            <strong>Connect (Instagram only)</strong> for IG comments without Page engagement
            scopes. Also confirm App Domains = radarcut.com, Privacy Policy URL is set, and Valid
            OAuth Redirect URIs includes{" "}
            <code className="break-all text-[10px]">{props.redirectUri}</code>.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {props.oauthConfigured && (!props.connected || needsReauth) ? (
            // Full-page navigation required — Next <Link> soft-nav to this API
            // route breaks the OAuth redirect and surfaces global-error.
            <>
              <Button size="sm" nativeButton={false} render={<a href="/api/meta/auth" />}>
                {needsReauth ? "Reconnect Meta" : "Connect Meta"}
              </Button>
              {props.loginConfigConfigured ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<a href="/api/meta/auth?classic=1" />}
                  >
                    Connect (classic scopes)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<a href="/api/meta/auth?ig_only=1" />}
                  >
                    Connect (Instagram only)
                  </Button>
                </>
              ) : null}
            </>
          ) : null}

          {props.connected ? (
            <>
              <form action={syncAction}>
                <Button type="submit" variant="outline" size="sm" disabled={syncPending}>
                  <RefreshCw className={`h-3.5 w-3.5 ${syncPending ? "animate-spin" : ""}`} />
                  Sync Meta Media
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

        {props.media.length > 0 ? (
          <div className="grid gap-2">
            <p className="text-xs font-medium text-foreground">Cached Meta media</p>
            <p className="text-xs text-muted-foreground">
              Associate a media ID with a product on the product edit page (Marketing video funnel).
              Sync updates view counts on already-linked posts without creating duplicates.
            </p>
            <ul className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-2">
              {props.media.map((item) => (
                <li
                  key={item.id}
                  className="grid gap-0.5 border-b border-dashed pb-2 last:border-0 last:pb-0"
                >
                  <p className="font-medium">
                    {item.platform} · {item.title || "Untitled"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    ID {item.externalId} · {Number(item.viewCount).toLocaleString()} views
                  </p>
                  {item.permalinkUrl ? (
                    <a
                      href={item.permalinkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-xs underline underline-offset-2"
                    >
                      {item.permalinkUrl}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : props.connected ? (
          <p className="text-xs text-muted-foreground">
            No cached media yet. Click Sync Meta Media after connecting.
          </p>
        ) : null}

        <div className="grid gap-2">
          <p className="text-xs font-medium text-foreground">Webhook deliveries</p>
          <p className="text-xs text-muted-foreground">
            After Meta → Webhooks → Instagram → <code className="text-[10px]">comments</code> →
            Test, refresh this page. A new row here means RadarCut received the POST.
          </p>
          {(props.webhookEvents?.length ?? 0) > 0 ? (
            <ul className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-2">
              {props.webhookEvents!.map((event) => (
                <li
                  key={event.id}
                  className="grid gap-0.5 border-b border-dashed pb-2 last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={event.signatureOk ? "secondary" : "destructive"}>
                      {event.signatureOk ? "OK" : "Bad signature"}
                    </Badge>
                    {event.object ? <Badge variant="outline">{event.object}</Badge> : null}
                    {event.fields ? (
                      <span className="text-[11px] text-muted-foreground">{event.fields}</span>
                    ) : null}
                  </div>
                  <p className="text-xs">{event.summary}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString()}
                    {event.commentEventCount > 0
                      ? ` · ${event.commentEventCount} comment event(s)`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              No webhook POSTs recorded yet. Use Meta&apos;s Test button, then refresh Settings.
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <p className="text-xs font-medium text-foreground">Comment auto-reply attempts</p>
          <p className="text-xs text-muted-foreground">
            Only appears when a comment matched a keyword on a linked marketing-video post.
            Dashboard Test payloads usually will not create a reply attempt.
          </p>
          {(props.autoReplyLogs?.length ?? 0) > 0 ? (
            <ul className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-2">
              {props.autoReplyLogs!.map((log) => (
                <li
                  key={log.id}
                  className="grid gap-0.5 border-b border-dashed pb-2 last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        log.status === "SUCCESS"
                          ? "secondary"
                          : log.status === "ERROR"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {log.status}
                    </Badge>
                    <Badge variant="outline">{log.platform}</Badge>
                    {log.keyword ? (
                      <span className="font-mono text-[11px]">{log.keyword}</span>
                    ) : null}
                  </div>
                  <p className="text-xs">
                    {log.productTitle ?? "Product"}
                    {log.commentText ? ` · “${log.commentText.slice(0, 80)}”` : ""}
                  </p>
                  {log.errorMessage ? (
                    <p className="text-[11px] text-destructive">{log.errorMessage}</p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No auto-reply attempts yet.</p>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Valid OAuth Redirect URI must be exactly:{" "}
          <code className="break-all">{props.redirectUri}</code>
          {props.loginConfigConfigured
            ? null
            : " · Also set META_LOGIN_CONFIG_ID after creating a Login for Business configuration."}
        </p>
      </CardContent>
    </Card>
  );
}
