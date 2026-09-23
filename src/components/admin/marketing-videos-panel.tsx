"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";

import { DeleteEntityButton } from "@/components/admin/delete-entity-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SOCIAL_PLATFORM_LABELS, SOCIAL_PLATFORMS } from "@/lib/social-external-id";
import {
  addMarketingVideoPostAction,
  deleteMarketingVideoAction,
  deleteMarketingVideoPostAction,
  saveMarketingVideoAction,
  syncMarketingVideoViewsAction,
  updateMarketingVideoLabelAction,
  type MarketingVideoActionState,
} from "@/server/actions/marketing-video.actions";

export interface MarketingVideoPostView {
  id: string;
  platform: keyof typeof SOCIAL_PLATFORM_LABELS;
  externalId: string;
  permalinkUrl: string | null;
  viewCount: string | number | bigint;
  syncStatus: string;
  lastSyncedAt: Date | string | null;
  lastSyncError: string | null;
}

export interface MarketingVideoView {
  id: string;
  title: string | null;
  utmCampaign: string | null;
  posts: MarketingVideoPostView[];
}

interface MarketingVideosPanelProps {
  productId: string;
  videos: MarketingVideoView[];
}

const initialState: MarketingVideoActionState = {};

function formatViews(value: string | number | bigint): string {
  return Number(value).toLocaleString();
}

function ActionAlerts({ state }: { state: MarketingVideoActionState }) {
  if (state.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  if (state.ok && state.message) {
    return (
      <Alert>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

function EditLabelForm({
  productId,
  videoId,
  currentTitle,
}: {
  productId: string;
  videoId: string;
  currentTitle: string;
}) {
  const [state, action, pending] = useActionState(updateMarketingVideoLabelAction, initialState);

  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="videoId" value={videoId} />
      <div className="grid min-w-[12rem] flex-1 gap-1">
        <Label htmlFor={`label-${videoId}`} className="text-xs">
          Label
        </Label>
        <Input
          id={`label-${videoId}`}
          name="title"
          defaultValue={currentTitle}
          required
          className="h-8"
        />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Update label"}
      </Button>
      <ActionAlerts state={state} />
    </form>
  );
}

function AddPlatformForm({
  productId,
  videoId,
  usedPlatforms,
}: {
  productId: string;
  videoId: string;
  usedPlatforms: Array<keyof typeof SOCIAL_PLATFORM_LABELS>;
}) {
  const [state, action, pending] = useActionState(addMarketingVideoPostAction, initialState);
  const available = SOCIAL_PLATFORMS.filter((platform) => !usedPlatforms.includes(platform));

  if (available.length === 0) {
    return null;
  }

  return (
    <form action={action} className="mt-3 grid gap-2 rounded border border-dashed p-2">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="videoId" value={videoId} />
      <p className="text-xs font-medium">Add another platform</p>
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
        <select
          name="platform"
          defaultValue={available[0]}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          {available.map((platform) => (
            <option key={platform} value={platform}>
              {SOCIAL_PLATFORM_LABELS[platform]}
            </option>
          ))}
        </select>
        <Input
          name="externalIdOrUrl"
          required
          placeholder="URL or ID"
          className="h-8"
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
      <ActionAlerts state={state} />
    </form>
  );
}

export function MarketingVideosPanel({ productId, videos }: MarketingVideosPanelProps) {
  const [saveState, saveAction, savePending] = useActionState(saveMarketingVideoAction, initialState);
  const [syncState, syncAction, syncPending] = useActionState(syncMarketingVideoViewsAction, initialState);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-sm">Marketing video funnel</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Paste a platform URL or ID and save — the label is set automatically (YouTube, Instagram,
            …). You can rename it anytime.
          </p>
        </div>
        <form action={syncAction}>
          <input type="hidden" name="productId" value={productId} />
          <Button type="submit" variant="outline" size="sm" disabled={syncPending || videos.length === 0}>
            <RefreshCw className={`h-3.5 w-3.5 ${syncPending ? "animate-spin" : ""}`} />
            Sync views
          </Button>
        </form>
      </CardHeader>
      <CardContent className="grid gap-6">
        <ActionAlerts state={saveState} />
        <ActionAlerts state={syncState} />

        {videos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No marketing videos linked yet.</p>
        ) : (
          <ul className="grid gap-3">
            {videos.map((video) => (
              <li key={video.id} className="rounded-md border px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{video.title || "Untitled video"}</p>
                    {video.utmCampaign ? (
                      <p className="text-xs text-muted-foreground">utm_campaign={video.utmCampaign}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No utm_campaign — site funnel uses all traffic
                      </p>
                    )}
                    <EditLabelForm
                      productId={productId}
                      videoId={video.id}
                      currentTitle={video.title || ""}
                    />
                  </div>
                  <DeleteEntityButton
                    action={deleteMarketingVideoAction}
                    hiddenFieldName="videoId"
                    hiddenFieldValue={video.id}
                    entityLabel={video.title || "marketing video"}
                    description="Removes this video and all platform post links."
                    extraFields={{ productId }}
                  />
                </div>
                <ul className="mt-3 grid gap-2">
                  {video.posts.map((post) => (
                    <li
                      key={post.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-dashed px-2 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">
                          {SOCIAL_PLATFORM_LABELS[post.platform]} · {formatViews(post.viewCount)} views
                        </p>
                        <p className="truncate text-muted-foreground">ID {post.externalId}</p>
                        {post.lastSyncError ? (
                          <p className="mt-1 text-destructive">{post.lastSyncError}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{post.syncStatus}</Badge>
                        <DeleteEntityButton
                          action={deleteMarketingVideoPostAction}
                          hiddenFieldName="postId"
                          hiddenFieldValue={post.id}
                          entityLabel={`${SOCIAL_PLATFORM_LABELS[post.platform]} post`}
                          extraFields={{ productId }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                <AddPlatformForm
                  productId={productId}
                  videoId={video.id}
                  usedPlatforms={video.posts.map((post) => post.platform)}
                />
              </li>
            ))}
          </ul>
        )}

        <form action={saveAction} className="grid gap-3 rounded-md border p-3">
          <input type="hidden" name="productId" value={productId} />
          <p className="text-sm font-medium">Add marketing video</p>
          <p className="text-xs text-muted-foreground">
            Fill one or more platforms. Label is set automatically from those platforms (e.g. only
            YouTube → “YouTube”).
          </p>
          <div className="grid gap-1.5 sm:max-w-md">
            <Label htmlFor="mv-campaign">utm_campaign (optional)</Label>
            <Input id="mv-campaign" name="utmCampaign" placeholder="product-x-launch" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {SOCIAL_PLATFORMS.map((platform) => (
              <div key={platform} className="grid gap-1.5">
                <Label htmlFor={`post_${platform}`}>
                  {SOCIAL_PLATFORM_LABELS[platform]} ID or URL
                </Label>
                <Input
                  id={`post_${platform}`}
                  name={`post_${platform}`}
                  placeholder={
                    platform === "YOUTUBE"
                      ? "YouTube URL or 11-char ID"
                      : platform === "TIKTOK"
                        ? "TikTok video URL or numeric ID"
                        : "Graph media / video ID (digits)"
                  }
                />
              </div>
            ))}
          </div>
          <Button type="submit" disabled={savePending} className="w-fit">
            {savePending ? "Saving…" : "Save video"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
