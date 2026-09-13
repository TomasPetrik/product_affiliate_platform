import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface ComingSoonProps {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: string;
}

/** Placeholder shown for admin sections whose functionality isn't implemented yet. */
export function ComingSoon({ icon: Icon, title, description, phase }: ComingSoonProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="rounded-full bg-muted p-3">
          <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        <p className="text-xs font-medium text-muted-foreground">Planned for {phase}</p>
      </CardContent>
    </Card>
  );
}
