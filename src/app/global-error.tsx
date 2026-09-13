"use client";

import { useEffect } from "react";

import "./globals.css";

/**
 * Last-resort error boundary. Only used when an error escapes every nested
 * `error.tsx` boundary, including the root layout itself — which is why it
 * must render its own <html>/<body> rather than relying on layout.tsx.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center font-sans">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          A critical error occurred and the page couldn&apos;t be rendered. Please try again.
        </p>
        <button
          onClick={reset}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
