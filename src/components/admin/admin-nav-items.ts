import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ClipboardList,
  Compass,
  Database,
  DollarSign,
  FolderTree,
  LayoutDashboard,
  Package,
  Settings,
  Store,
  UploadCloud,
} from "lucide-react";

import { SITE_NAME_ADMIN } from "@/lib/brand";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Marks sections whose functionality lands in a later implementation phase. */
  comingSoon?: boolean;
}

/**
 * Single source of truth for admin navigation — consumed by the sidebar and
 * (for the mobile sheet) any future duplicate nav. Keep this in sync with
 * the routes under `src/app/admin/*`.
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/marketplaces", label: "Marketplaces", icon: Store },
  { href: "/admin/imports", label: "Imports", icon: UploadCloud, comingSoon: true },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/revenue", label: "Revenue", icon: DollarSign },
  { href: "/admin/audit-log", label: "Audit log", icon: ClipboardList },
  { href: "/admin/database", label: "Database", icon: Database },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export const ADMIN_BRAND = {
  href: "/admin",
  label: SITE_NAME_ADMIN,
  icon: Compass,
};
