"use client";

import { useActionState, useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  updateAmazonOfferSettingsAction,
  type SiteSettingsActionState,
} from "@/server/actions/site-settings.actions";

export interface AmazonOfferSettingsCardProps {
  preferAmazonWhenCheapest: boolean;
  forceAmazonOnly: boolean;
}

const initialState: SiteSettingsActionState = {};

export function AmazonOfferSettingsCard({
  preferAmazonWhenCheapest: initialPrefer,
  forceAmazonOnly: initialForce,
}: AmazonOfferSettingsCardProps) {
  const [state, action, pending] = useActionState(updateAmazonOfferSettingsAction, initialState);
  const [preferAmazonWhenCheapest, setPreferAmazonWhenCheapest] = useState(initialPrefer);
  const [forceAmazonOnly, setForceAmazonOnly] = useState(initialForce);

  useEffect(() => {
    if (state.success) {
      if (typeof state.preferAmazonWhenCheapest === "boolean") {
        setPreferAmazonWhenCheapest(state.preferAmazonWhenCheapest);
      }
      if (typeof state.forceAmazonOnly === "boolean") {
        setForceAmazonOnly(state.forceAmazonOnly);
      }
    }
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Amazon offer visibility</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <p className="text-muted-foreground">
          Control when Amazon is the only retailer shown on product pages. Both options can be
          turned off at any time.
        </p>

        <form action={action} className="grid gap-4">
          <input
            type="hidden"
            name="preferAmazonWhenCheapest"
            value={preferAmazonWhenCheapest ? "true" : "false"}
          />
          <input type="hidden" name="forceAmazonOnly" value={forceAmazonOnly ? "true" : "false"} />

          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <Label htmlFor="preferAmazonWhenCheapest">Prefer Amazon when cheapest</Label>
              <p className="text-xs text-muted-foreground">
                If Amazon matches or beats other retailers on price, hide eBay and the rest.
              </p>
            </div>
            <Switch
              id="preferAmazonWhenCheapest"
              checked={preferAmazonWhenCheapest}
              onCheckedChange={setPreferAmazonWhenCheapest}
              disabled={pending}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <Label htmlFor="forceAmazonOnly">Force Amazon only</Label>
              <p className="text-xs text-muted-foreground">
                Always show Amazon offers only, even when another retailer is cheaper.
              </p>
            </div>
            <Switch
              id="forceAmazonOnly"
              checked={forceAmazonOnly}
              onCheckedChange={setForceAmazonOnly}
              disabled={pending}
            />
          </div>

          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          {state.success ? (
            <Alert>
              <AlertDescription>Amazon offer settings saved.</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
