"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveCategoryAction, type CategoryActionState } from "@/server/actions/category.actions";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export interface CategoryFormValues {
  id?: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
}

const emptyValues: CategoryFormValues = { name: "", slug: "", description: "", isActive: true, sortOrder: 0 };

interface CategoryFormProps {
  defaultValues?: CategoryFormValues;
}

const initialState: CategoryActionState = {};

export function CategoryForm({ defaultValues = emptyValues }: CategoryFormProps) {
  const [state, formAction, pending] = useActionState(saveCategoryAction, initialState);
  const [slug, setSlug] = useState(defaultValues.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(defaultValues.id));
  const router = useRouter();

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      {defaultValues.id ? <input type="hidden" name="categoryId" value={defaultValues.id} /> : null}

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={defaultValues.name}
          onChange={(event) => {
            if (!slugTouched) {
              setSlug(slugify(event.target.value));
            }
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          name="slug"
          required
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
        />
        <p className="text-xs text-muted-foreground">Used in the public URL: /categories/{slug || "…"}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} defaultValue={defaultValues.description} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sortOrder">Sort order</Label>
        <Input
          id="sortOrder"
          name="sortOrder"
          type="number"
          min={0}
          className="w-32"
          defaultValue={defaultValues.sortOrder}
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch id="isActive" name="isActive" defaultChecked={defaultValues.isActive} />
        <Label htmlFor="isActive">Active (visible on the public site)</Label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : defaultValues.id ? "Save changes" : "Create category"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/categories")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
