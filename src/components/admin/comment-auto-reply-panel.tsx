"use client";

import { useActionState } from "react";

import { DeleteEntityButton } from "@/components/admin/delete-entity-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createCommentAutoReplyRuleAction,
  deleteCommentAutoReplyRuleAction,
  toggleCommentAutoReplyRuleAction,
  updateCommentAutoReplyRuleAction,
  type CommentAutoReplyActionState,
} from "@/server/actions/comment-auto-reply.actions";
import {
  DEFAULT_DM_REPLY_MESSAGE,
  DEFAULT_PUBLIC_REPLY_MESSAGE,
} from "@/server/services/comment-auto-reply.helpers";

export interface CommentAutoReplyRuleView {
  id: string;
  keyword: string;
  publicReplyMessage: string;
  dmReplyMessage: string;
  replyUrl: string;
  enablePublicReply: boolean;
  enablePrivateDm: boolean;
  enableInstagram: boolean;
  enableFacebook: boolean;
  enableTikTok: boolean;
  isActive: boolean;
}

interface CommentAutoReplyPanelProps {
  productId: string;
  defaultReplyUrl: string;
  rules: CommentAutoReplyRuleView[];
}

const initialState: CommentAutoReplyActionState = {};

function ActionAlerts({ state }: { state: CommentAutoReplyActionState }) {
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

function ChannelChecks({
  enablePublicReply,
  enablePrivateDm,
  enableInstagram,
  enableFacebook,
  enableTikTok,
}: {
  enablePublicReply: boolean;
  enablePrivateDm: boolean;
  enableInstagram: boolean;
  enableFacebook: boolean;
  enableTikTok: boolean;
}) {
  return (
    <div className="grid gap-2 text-sm">
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="enablePublicReply"
            value="on"
            defaultChecked={enablePublicReply}
            className="size-4 rounded border"
          />
          Public comment
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="enablePrivateDm"
            value="on"
            defaultChecked={enablePrivateDm}
            className="size-4 rounded border"
          />
          Private DM
        </label>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="enableInstagram"
            value="on"
            defaultChecked={enableInstagram}
            className="size-4 rounded border"
          />
          Instagram
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="enableFacebook"
            value="on"
            defaultChecked={enableFacebook}
            className="size-4 rounded border"
          />
          Facebook
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="enableTikTok"
            value="on"
            defaultChecked={enableTikTok}
            className="size-4 rounded border"
          />
          TikTok
        </label>
      </div>
    </div>
  );
}

function AdvancedMessageFields({
  idPrefix,
  publicReplyMessage,
  dmReplyMessage,
  replyUrl,
  defaultOpen = false,
}: {
  idPrefix: string;
  publicReplyMessage: string;
  dmReplyMessage: string;
  replyUrl: string;
  defaultOpen?: boolean;
}) {
  return (
    <details className="rounded-md border border-dashed p-3" open={defaultOpen || undefined}>
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
        Advanced — customize messages & link
      </summary>
      <div className="mt-3 grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-public`}>Public comment message</Label>
          <Textarea
            id={`${idPrefix}-public`}
            name="publicReplyMessage"
            defaultValue={publicReplyMessage}
            rows={2}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-dm`}>Private DM message</Label>
          <Textarea
            id={`${idPrefix}-dm`}
            name="dmReplyMessage"
            defaultValue={dmReplyMessage}
            rows={2}
          />
          <p className="text-[11px] text-muted-foreground">
            The affiliate link below is appended to the DM automatically.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-url`}>Affiliate / product link (for DM)</Label>
          <Input
            id={`${idPrefix}-url`}
            name="replyUrl"
            type="url"
            defaultValue={replyUrl}
            required
          />
        </div>
      </div>
    </details>
  );
}

function EditRuleForm({
  productId,
  rule,
}: {
  productId: string;
  rule: CommentAutoReplyRuleView;
}) {
  const [state, action, pending] = useActionState(updateCommentAutoReplyRuleAction, initialState);
  const [toggleState, toggleAction, togglePending] = useActionState(
    toggleCommentAutoReplyRuleAction,
    initialState,
  );

  return (
    <li className="rounded-md border px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">
            Keyword: <span className="font-mono">{rule.keyword}</span>
          </p>
          {rule.isActive ? (
            <Badge variant="secondary">Active</Badge>
          ) : (
            <Badge variant="outline">Disabled</Badge>
          )}
          {rule.enablePublicReply ? <Badge variant="outline">Comment</Badge> : null}
          {rule.enablePrivateDm ? <Badge variant="outline">DM</Badge> : null}
          {rule.enableInstagram ? <Badge variant="outline">IG</Badge> : null}
          {rule.enableFacebook ? <Badge variant="outline">FB</Badge> : null}
          {rule.enableTikTok ? <Badge variant="outline">TT</Badge> : null}
        </div>
        <DeleteEntityButton
          action={deleteCommentAutoReplyRuleAction}
          hiddenFieldName="ruleId"
          hiddenFieldValue={rule.id}
          entityLabel={`keyword “${rule.keyword}”`}
          description="Stops auto-replies for this keyword. Past reply logs are kept."
          extraFields={{ productId }}
        />
      </div>

      <form action={toggleAction} className="mt-2">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="ruleId" value={rule.id} />
        {!rule.isActive ? <input type="hidden" name="isActive" value="on" /> : null}
        <Button type="submit" variant="ghost" size="sm" disabled={togglePending}>
          {togglePending ? "Updating…" : rule.isActive ? "Disable" : "Enable"}
        </Button>
        <ActionAlerts state={toggleState} />
      </form>

      <form action={action} className="mt-3 grid gap-3">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="ruleId" value={rule.id} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            value="on"
            defaultChecked={rule.isActive}
            className="size-4 rounded border"
          />
          Active
        </label>
        <div className="grid gap-1.5 sm:max-w-sm">
          <Label htmlFor={`keyword-${rule.id}`}>Keyword</Label>
          <Input id={`keyword-${rule.id}`} name="keyword" defaultValue={rule.keyword} required />
        </div>
        <ChannelChecks
          enablePublicReply={rule.enablePublicReply}
          enablePrivateDm={rule.enablePrivateDm}
          enableInstagram={rule.enableInstagram}
          enableFacebook={rule.enableFacebook}
          enableTikTok={rule.enableTikTok}
        />
        <AdvancedMessageFields
          idPrefix={`edit-${rule.id}`}
          publicReplyMessage={rule.publicReplyMessage}
          dmReplyMessage={rule.dmReplyMessage}
          replyUrl={rule.replyUrl}
        />
        <Button type="submit" variant="outline" size="sm" className="w-fit" disabled={pending}>
          {pending ? "Saving…" : "Update rule"}
        </Button>
        <ActionAlerts state={state} />
      </form>
    </li>
  );
}

export function CommentAutoReplyPanel({
  productId,
  defaultReplyUrl,
  rules,
}: CommentAutoReplyPanelProps) {
  const [createState, createAction, createPending] = useActionState(
    createCommentAutoReplyRuleAction,
    initialState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Comment keyword → reply / DM</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Set the keyword people comment (e.g. <span className="font-mono">LINK</span>). Public
          comment and DM copy are prefilled; the DM includes your tracked affiliate hop link.
          Matching is case-insensitive contains. Platforms: Instagram, Facebook, TikTok. Meta needs{" "}
          <strong>Page → feed</strong> webhooks; TikTok uses Business Accounts comment webhooks +
          Messaging (see Admin → Tools → TikTok comment demo for the review prototype).
        </p>
      </CardHeader>
      <CardContent className="grid gap-6">
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No keyword rules yet — add one below.</p>
        ) : (
          <ul className="grid gap-3">
            {rules.map((rule) => (
              <EditRuleForm key={rule.id} productId={productId} rule={rule} />
            ))}
          </ul>
        )}

        <form action={createAction} className="grid gap-3 rounded-md border p-3">
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="isActive" value="on" />
          <p className="text-sm font-medium">Add keyword</p>
          <div className="grid gap-1.5 sm:max-w-sm">
            <Label htmlFor="car-keyword">Keyword</Label>
            <Input
              id="car-keyword"
              name="keyword"
              placeholder="LINK"
              required
              autoComplete="off"
            />
          </div>
          <ChannelChecks
            enablePublicReply
            enablePrivateDm
            enableInstagram
            enableFacebook
            enableTikTok
          />
          <AdvancedMessageFields
            idPrefix="new"
            publicReplyMessage={DEFAULT_PUBLIC_REPLY_MESSAGE}
            dmReplyMessage={DEFAULT_DM_REPLY_MESSAGE}
            replyUrl={defaultReplyUrl}
          />
          <p className="text-[11px] text-muted-foreground">
            Prefill: comment “{DEFAULT_PUBLIC_REPLY_MESSAGE}” · DM “{DEFAULT_DM_REPLY_MESSAGE}{" "}
            {defaultReplyUrl}”
          </p>
          <Button type="submit" disabled={createPending} className="w-fit">
            {createPending ? "Saving…" : "Add keyword rule"}
          </Button>
          <ActionAlerts state={createState} />
        </form>
      </CardContent>
    </Card>
  );
}
