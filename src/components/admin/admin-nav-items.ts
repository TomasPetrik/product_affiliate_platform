import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ClipboardList,
  Compass,
  DollarSign,
  FolderTree,
  LayoutDashboard,
  Package,
  Settings,
  UploadCloud,
} from "lucide-react";

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
  { href: "/admin/imports", label: "Imports", icon: UploadCloud, comingSoon: true },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, comingSoon: true },
  { href: "/admin/revenue", label: "Revenue", icon: DollarSign, comingSoon: true },
  { href: "/admin/audit-log", label: "Audit log", icon: ClipboardList, comingSoon: true },
  { href: "/admin/settings", label: "Settings", icon: Settings, comingSoon: true },
];

export const ADMIN_BRAND = {
  href: "/admin",
  label: "FindIt Admin",
  icon: Compass,
};
