import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const GRADIENTS = [
  "from-orange-200 to-amber-100",
  "from-sky-200 to-cyan-100",
  "from-violet-200 to-fuchsia-100",
  "from-emerald-200 to-lime-100",
  "from-rose-200 to-pink-100",
  "from-indigo-200 to-blue-100",
] as const;

/** Small, deterministic hash so the same seed always maps to the same gradient. */
function pickGradient(seed: string): string {
  const hash = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return GRADIENTS[hash % GRADIENTS.length];
}

interface ProductImagePlaceholderProps {
  seed: string;
  className?: string;
}

/**
 * Stands in for real product imagery until product images are populated
 * from manual uploads or the marketplace import pipeline (Phase 5).
 */
export function ProductImagePlaceholder({ seed, className }: ProductImagePlaceholderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-gradient-to-br",
        pickGradient(seed),
        className,
      )}
      role="img"
      aria-label="Product image placeholder"
    >
      <ImageIcon className="h-10 w-10 text-black/30" strokeWidth={1.5} />
    </div>
  );
}
