import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PgAdminButtonProps {
  variant?: "default" | "outline";
}

/** Opens the VPS pgAdmin UI. That path is served by Apache, not Next.js. */
export function PgAdminButton({ variant = "default" }: PgAdminButtonProps) {
  return (
    <Button
      variant={variant}
      nativeButton={false}
      render={<a href="/pgadmin4/" target="_blank" rel="noopener noreferrer" />}
    >
      <ExternalLink className="h-4 w-4" />
      Open pgAdmin
    </Button>
  );
}
