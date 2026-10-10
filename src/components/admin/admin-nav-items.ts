import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Clapperboard,
  ClipboardList,
  Database,
  DollarSign,
  Film,
  FolderTree,
  LayoutDashboard,
  MessageSquareText,
  Package,
  RefreshCw,
  Scissors,
  Settings,
  Sparkles,
  Store,
  UploadCloud,
  Video,
} from "lucide-react";
import type { ComponentType } from "react";

import { RadarMark } from "@/components/public/site-logo";
import { SITE_NAME_ADMIN } from "@/lib/brand";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Marks sections whose functionality lands in a later implementation phase. */
  comingSoon?: boolean;
}

export interface AdminNavGroup {
  /** Section heading shown above the links. Omit for ungrouped top items. */
  label?: string;
  items: AdminNavItem[];
}

/**
 * Single source of truth for admin navigation — consumed by the sidebar and
 * (for the mobile sheet) any future duplicate nav. Keep this in sync with
 * the routes under `src/app/admin/*`.
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/categories", label: "Categories", icon: FolderTree },
      { href: "/admin/marketplaces", label: "Marketplaces", icon: Store },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/admin/imports", label: "Imports", icon: UploadCloud },
      { href: "/admin/price-sync", label: "Price sync", icon: RefreshCw },
    ],
  },
  {
    label: "Creative tools",
    items: [
      { href: "/admin/tools/video-frames", label: "Video creator", icon: Film },
      { href: "/admin/tools/krea-video", label: "Krea video", icon: Clapperboard },
      { href: "/admin/tools/wan-video", label: "Wan video reference", icon: Video },
      { href: "/admin/tools/wan-video-edit", label: "Wan video edit", icon: Scissors },
      { href: "/admin/tools/wan-image-edit", label: "Wan image edit", icon: Sparkles },
      {
        href: "/admin/tools/tiktok-comment-demo",
        label: "TikTok comment demo",
        icon: MessageSquareText,
      },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/admin/revenue", label: "Revenue", icon: DollarSign },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/audit-log", label: "Audit log", icon: ClipboardList },
      { href: "/admin/database", label: "Database", icon: Database },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

/** Flat list for callers that only need hrefs / labels (e.g. breadcrumbs). */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap(
  (group) => group.items,
);

export const ADMIN_BRAND = {
  href: "/admin",
  label: SITE_NAME_ADMIN,
  icon: RadarMark as ComponentType<{ className?: string }>,
};
