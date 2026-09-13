"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ADMIN_BRAND, ADMIN_NAV_ITEMS } from "@/components/admin/admin-nav-items";

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface AdminSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

/** Reusable admin navigation, rendered both in the persistent desktop rail and the mobile sheet. */
export function AdminSidebar({ className, onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();
  const BrandIcon = ADMIN_BRAND.icon;

  return (
    <div className={cn("flex h-full flex-col gap-6", className)}>
      <Link href={ADMIN_BRAND.href} className="flex items-center gap-2 px-2 font-semibold" onClick={onNavigate}>
        <BrandIcon className="h-5 w-5 text-primary" aria-hidden="true" />
        <span>{ADMIN_BRAND.label}</span>
      </Link>

      <nav className="flex flex-col gap-1">
        {ADMIN_NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center justify-between rounded-md px-2 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </span>
              {item.comingSoon ? (
                <Badge variant="secondary" className="text-[10px]">
                  Soon
                </Badge>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
