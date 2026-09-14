import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="max-w-2xl">
        {eyebrow ? <p className="text-eyebrow">{eyebrow}</p> : null}
        <h1 className={cn("text-page-title", eyebrow && "mt-2")}>{title}</h1>
        {description ? (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
