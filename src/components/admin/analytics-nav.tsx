"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export const ANALYTICS_NAV = [
  { href: "/admin/analytics", label: "Overview" },
  { href: "/admin/analytics/countries", label: "Countries" },
  { href: "/admin/analytics/retailers", label: "Retailers" },
  { href: "/admin/analytics/sources", label: "Sources" },
  { href: "/admin/analytics/campaigns", label: "Campaigns" },
  { href: "/admin/analytics/devices", label: "Devices" },
  { href: "/admin/analytics/searches", label: "Searches" },
] as const;

export function AnalyticsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Analytics sections" className="-mx-1 overflow-x-auto">
      <ul className="flex w-max gap-1">
        {ANALYTICS_NAV.map((item) => {
          const active = item.href === "/admin/analytics" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "inline-flex h-8 items-center rounded-full px-3 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
