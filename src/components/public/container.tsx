import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ContainerProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "header" | "footer" | "nav";
}

/** Centered public-site shell, ~1320px, with consistent horizontal padding. */
export function Container({ children, className, as: Comp = "div" }: ContainerProps) {
  return <Comp className={cn("mx-auto w-full min-w-0 max-w-[1320px] px-5 sm:px-6 lg:px-8", className)}>{children}</Comp>;
}
