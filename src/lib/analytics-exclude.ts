import { isPublicClientIp, normalizeCountryCode } from "@/lib/geo";

function stripMappedIpv6(ip: string): string {
  return ip.replace(/^::ffff:/i, "").trim().toLowerCase();
}

export function parseExcludedIps(raw: string | null | undefined): Set<string> {
  const ips = new Set<string>();
  for (const part of (raw ?? "").split(/[,;\s]+/)) {
    const ip = stripMappedIpv6(part);
    if (!ip || !isPublicClientIp(ip)) continue;
    ips.add(ip);
  }
  return ips;
}

export function parseExcludedCountries(raw: string | null | undefined): Set<string> {
  const countries = new Set<string>();
  for (const part of (raw ?? "").split(/[,;\s]+/)) {
    const code = normalizeCountryCode(part);
    if (code) countries.add(code);
  }
  return countries;
}

export function isExcludedAnalyticsVisitor(
  visitor: { ip?: string | null; country?: string | null },
  excluded: { ips?: Iterable<string>; countries?: Iterable<string> } = {},
): boolean {
  const ips = excluded.ips instanceof Set ? excluded.ips : new Set(excluded.ips ? [...excluded.ips].map((ip) => stripMappedIpv6(ip)) : []);
  const countries = excluded.countries instanceof Set ? excluded.countries : new Set(excluded.countries ?? []);

  const ip = visitor.ip ? stripMappedIpv6(visitor.ip) : "";
  if (ip && ips.has(ip)) return true;

  const country = normalizeCountryCode(visitor.country);
  return Boolean(country && countries.has(country));
}
