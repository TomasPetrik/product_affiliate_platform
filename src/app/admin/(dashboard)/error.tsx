"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface AdminErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    // TODO(hardening phase): forward to Sentry/logging once configured.
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
      <h2 className="text-lg font-semibold">Something went wrong loading this section</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred."}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
