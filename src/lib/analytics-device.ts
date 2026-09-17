import type { DeviceType } from "@/generated/prisma/client";

export function normalizeDeviceType(value: string | null | undefined): DeviceType | null {
  if (!value) return "DESKTOP";
  const normalized = value.toLowerCase();
  if (normalized === "mobile") return "MOBILE";
  if (normalized === "tablet") return "TABLET";
  if (normalized === "desktop") return "DESKTOP";
  return "DESKTOP";
}

export function deviceLabel(value: string | null | undefined): string {
  if (value === "MOBILE") return "Mobile";
  if (value === "TABLET") return "Tablet";
  if (value === "DESKTOP") return "Desktop";
  return "Unknown";
}

export function parseBrowserName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed ? trimmed.slice(0, 80) : null;
}

export function parseOperatingSystem(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed ? trimmed.slice(0, 80) : null;
}
