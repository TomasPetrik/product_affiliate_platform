const NOTICE_MESSAGES = {
  created: "Product created.",
  updated: "Product saved.",
  deleted: "Product deleted.",
  published: "Product published.",
  unpublished: "Product moved back to draft.",
  "bulk-published": "Selected products published.",
  "bulk-unpublished": "Selected products unpublished.",
  imported: "Product imported. Replace the hero image if the eBay photo looks unprofessional.",
  "hero-updated": "Hero image updated.",
} as const;

export type AdminNoticeKey = keyof typeof NOTICE_MESSAGES;

export function adminNoticeMessage(key: string | undefined, count?: string): string | undefined {
  if (!key || !(key in NOTICE_MESSAGES)) {
    return undefined;
  }

  const message = NOTICE_MESSAGES[key as AdminNoticeKey];
  if (count && (key === "bulk-published" || key === "bulk-unpublished")) {
    const n = Number(count);
    if (Number.isFinite(n) && n > 0) {
      return key === "bulk-published"
        ? `${n} ${n === 1 ? "product" : "products"} published.`
        : `${n} ${n === 1 ? "product" : "products"} unpublished.`;
    }
  }

  return message;
}

/** Prevents open redirects — only paths under the products admin are allowed. */
export function safeAdminProductsReturnTo(value: unknown, fallback = "/admin/products"): string {
  if (typeof value !== "string" || !value.startsWith("/admin/products")) {
    return fallback;
  }
  if (value.startsWith("//") || value.includes("://") || value.includes("\\")) {
    return fallback;
  }
  return value;
}

export function withAdminNotice(path: string, notice: AdminNoticeKey, extras?: Record<string, string>): string {
  const url = new URL(path, "http://local.invalid");
  url.searchParams.set("notice", notice);
  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      url.searchParams.set(key, value);
    }
  }
  return `${url.pathname}${url.search}`;
}
