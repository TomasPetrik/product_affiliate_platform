"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PublicErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Route-level error boundary for the public site. Next.js renders this in
 * place of the page when a Server or Client Component throws during
 * rendering. Kept deliberately generic — no internal error details are
 * shown to visitors.
 */
export default function PublicError({ error, reset }: PublicErrorProps) {
  useEffect(() => {
    // TODO(hardening phase): forward to Sentry/logging once configured.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <AlertTriangle className="size-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="mt-4 text-page-title">Something went wrong</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        We hit an unexpected error loading this page. You can try again, or head back home.
      </p>
      <div className="mt-8 flex gap-3">
        <Button onClick={reset} size="cta">
          Try again
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />} size="cta">
          Go home
        </Button>
      </div>
    </div>
  );
}
