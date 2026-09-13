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
  src?: string | null;
  alt?: string;
  className?: string;
}

/**
 * Product photo when a URL exists; otherwise a deterministic gradient
 * placeholder until uploads or marketplace import populate images.
 */
export function ProductImagePlaceholder({ seed, src, alt, className }: ProductImagePlaceholderProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt ?? ""} className={cn("object-cover", className)} />
    );
  }

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
