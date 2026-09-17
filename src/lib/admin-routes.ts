export const ADMIN_PROXY_MATCHER = ["/admin/:path*"] as const;

export function isAdminAnalyticsPath(pathname: string): boolean {
  return pathname === "/admin/analytics" || pathname.startsWith("/admin/analytics/");
}
