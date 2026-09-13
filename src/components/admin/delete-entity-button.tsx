"use client";

import { useId } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeleteEntityButtonProps {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFieldName: string;
  hiddenFieldValue: string;
  entityLabel: string;
  extraFields?: Record<string, string>;
}

/**
 * Icon button + confirmation dialog for destructive admin actions. The form
 * lives outside the dialog's portal (dialogs render into `document.body`),
 * so the submit button is linked back to it via the HTML `form` attribute
 * rather than DOM nesting.
 */
export function DeleteEntityButton({
  action,
  hiddenFieldName,
  hiddenFieldValue,
  entityLabel,
  extraFields,
}: DeleteEntityButtonProps) {
  const formId = useId();

  return (
    <AlertDialog>
      <form id={formId} action={action}>
        <input type="hidden" name={hiddenFieldName} value={hiddenFieldValue} />
        {extraFields
          ? Object.entries(extraFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))
          : null}
      </form>

      <AlertDialogTrigger
        render={<Button type="button" variant="ghost" size="icon" aria-label={`Delete ${entityLabel}`} />}
      >
        <Trash2 className="h-4 w-4" />
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {entityLabel}?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction type="submit" form={formId} variant="destructive">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
