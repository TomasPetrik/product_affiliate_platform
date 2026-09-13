"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface AdminFlashProps {
  notice?: string;
  error?: string;
}

export function AdminFlash({ notice, error }: AdminFlashProps) {
  const [hidden, setHidden] = useState(false);
  const message = error || notice;

  if (hidden || !message) {
    return null;
  }

  return (
    <Alert variant={error ? "destructive" : "default"}>
      <AlertDescription>{message}</AlertDescription>
      <AlertAction>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Dismiss notification"
          onClick={() => setHidden(true)}
        >
          <X />
        </Button>
      </AlertAction>
    </Alert>
  );
}
