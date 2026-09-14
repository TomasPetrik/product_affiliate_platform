"use client";

import { OPEN_PRIVACY_SETTINGS_EVENT } from "@/lib/consent";
import { cn } from "@/lib/utils";

export function PrivacySettingsLink({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn("underline-offset-2 hover:text-foreground hover:underline", className)}
      onClick={() => window.dispatchEvent(new Event(OPEN_PRIVACY_SETTINGS_EVENT))}
    >
      {children}
    </button>
  );
}
