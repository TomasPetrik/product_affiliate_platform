import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <Card className={cn(className)}>
      <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="rounded-full bg-muted p-3 text-muted-foreground">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="mt-4 text-sm font-semibold">{title}</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
