"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMarketplaceAction, type MarketplaceActionState } from "@/server/actions/marketplace.actions";

const initialState: MarketplaceActionState = {};

interface MarketplaceEditFormProps {
  marketplace: {
    id: string;
    name: string;
    baseUrl: string;
    logoUrl: string | null;
    isActive: boolean;
  };
}

export function MarketplaceEditForm({ marketplace }: MarketplaceEditFormProps) {
  const [state, formAction, pending] = useActionState(updateMarketplaceAction, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="marketplaceId" value={marketplace.id} />

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.success ? (
        <Alert>
          <AlertDescription>Marketplace saved.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-1.5">
        <Label htmlFor={`name-${marketplace.id}`}>Name</Label>
        <Input id={`name-${marketplace.id}`} name="name" defaultValue={marketplace.name} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`baseUrl-${marketplace.id}`}>Base URL</Label>
        <Input id={`baseUrl-${marketplace.id}`} name="baseUrl" type="url" defaultValue={marketplace.baseUrl} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`logoUrl-${marketplace.id}`}>Logo URL</Label>
        <Input id={`logoUrl-${marketplace.id}`} name="logoUrl" type="url" defaultValue={marketplace.logoUrl ?? ""} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`isActive-${marketplace.id}`}>Status</Label>
        <select
          id={`isActive-${marketplace.id}`}
          name="isActive"
          defaultValue={marketplace.isActive ? "true" : "false"}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save marketplace"}
        </Button>
      </div>
    </form>
  );
}
