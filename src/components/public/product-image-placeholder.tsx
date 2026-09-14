import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface ProductImagePlaceholderProps {
  seed: string;
  src?: string | null;
  alt?: string;
  className?: string;
  fit?: "cover" | "contain";
}

/**
 * Product photo when a URL exists; otherwise a quiet placeholder until
 * uploads or marketplace import populate images.
 */
export function ProductImagePlaceholder({
  src,
  alt,
  className,
  fit = "cover",
}: ProductImagePlaceholderProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? ""}
        className={cn(
          "block max-w-full object-center",
          fit === "contain" ? "object-contain" : "object-cover",
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn("flex items-center justify-center bg-image-well", className)}
      role="img"
      aria-label="Product image placeholder"
    >
      <ImageIcon className="size-10 text-muted-foreground/40" strokeWidth={1.25} />
    </div>
  );
}
