"use client";

import { useId, type ReactElement } from "react";

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

interface ConfirmFormButtonProps {
  action: (formData: FormData) => void | Promise<void>;
  fields?: Record<string, string>;
  title: string;
  description: string;
  confirmLabel: string;
  trigger: ReactElement;
  confirmVariant?: "default" | "destructive";
  disabled?: boolean;
}

/**
 * Confirmation dialog that submits a server-action form. The form lives
 * outside the dialog portal so the confirm button can target it via `form`.
 */
export function ConfirmFormButton({
  action,
  fields,
  title,
  description,
  confirmLabel,
  trigger,
  confirmVariant = "default",
  disabled,
}: ConfirmFormButtonProps) {
  const formId = useId();

  return (
    <AlertDialog>
      <form id={formId} action={action}>
        {fields
          ? Object.entries(fields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))
          : null}
      </form>

      <AlertDialogTrigger disabled={disabled} render={trigger} />

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction type="submit" form={formId} variant={confirmVariant}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
