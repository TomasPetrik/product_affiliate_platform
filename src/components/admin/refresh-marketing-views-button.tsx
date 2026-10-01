"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";

import {
  MarketingVideoSyncResultsDialog,
  useMarketingVideoSyncResultsDialog,
} from "@/components/admin/marketing-video-sync-results-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  refreshAnalyticsMarketingVideoViewsAction,
  type MarketingVideoActionState,
} from "@/server/actions/marketing-video.actions";

const initialState: MarketingVideoActionState = {};

export function RefreshMarketingViewsButton() {
  const [state, action, pending] = useActionState(
    refreshAnalyticsMarketingVideoViewsAction,
    initialState,
  );
  const { open, setOpen, summary } = useMarketingVideoSyncResultsDialog(
    state.syncSummary,
    state.ok,
  );

  return (
    <div className="grid shrink-0 gap-2">
      <form action={action} className="flex justify-end">
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
          Refresh views
        </Button>
      </form>
      {state.error ? (
        <Alert variant="destructive" className="max-w-sm">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <MarketingVideoSyncResultsDialog
        open={open}
        onOpenChange={setOpen}
        summary={summary}
        message={state.message}
      />
    </div>
  );
}
