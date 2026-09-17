/**
 * Server-side visitor geo.
 *
 * Prefers CDN / reverse-proxy country headers when present. On a VPS without
 * those headers, looks up an approximate country / region / city from the
 * client IP using a local database. Never asks the browser for location and
 * never stores a raw IP here.
 */

import { createRequire } from "node:module";

export interface VisitorGeo {
  country: string | null;
  region: string | null;
  city: string | null;
}

export type GeoIpLookup = (ip: string) => VisitorGeo;

const EMPTY_GEO: VisitorGeo = { country: null, region: null, city: null };

type GeoIpLiteModule = {
  lookup(ip: string): { country?: string; region?: string; city?: string } | null;
};

let geoIpLite: GeoIpLiteModule | null | undefined;

function loadGeoIpLite(): GeoIpLiteModule | null {
  if (geoIpLite !== undefined) return geoIpLite;
  try {
    const require = createRequire(import.meta.url);
    geoIpLite = require("geoip-lite") as GeoIpLiteModule;
  } catch {
    geoIpLite = null;
  }
  return geoIpLite;
}

export function countryFromHeaders(headerStore: { get(name: string): string | null }): string | null {
  const raw =
    headerStore.get("cf-ipcountry") ??
    headerStore.get("x-vercel-ip-country") ??
    headerStore.get("cloudfront-viewer-country") ??
    headerStore.get("x-country-code");

  return normalizeCountryCode(raw);
}

export function regionFromHeaders(headerStore: { get(name: string): string | null }): string | null {
  const raw =
    headerStore.get("cf-region-code") ??
    headerStore.get("x-vercel-ip-country-region") ??
    headerStore.get("cloudfront-viewer-country-region") ??
    headerStore.get("x-region-code");

  return normalizeRegionCode(raw);
}

export function cityFromHeaders(headerStore: { get(name: string): string | null }): string | null {
  const raw =
    headerStore.get("cf-ipcity") ??
    headerStore.get("x-vercel-ip-city") ??
    headerStore.get("cloudfront-viewer-city") ??
    headerStore.get("x-city");

  if (!raw) return null;
  try {
    return normalizeCityName(decodeURIComponent(raw.replaceAll("+", " ")));
  } catch {
    return normalizeCityName(raw);
  }
}

export function languageFromHeaders(headerStore: { get(name: string): string | null }): string | null {
  const raw = headerStore.get("accept-language");
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim().split(";")[0]?.trim();
  if (!first || first.length > 16) return null;
  if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(first)) return null;
  return first.slice(0, 16);
}

export function normalizeCountryCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (code === "XX" || code === "T1") return null;
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

export function parseCountryPathParam(raw: string | null | undefined): string | "unknown" | null {
  if (!raw) return null;
  if (raw.trim().toLowerCase() === "unknown") return "unknown";
  return normalizeCountryCode(raw);
}

export function normalizeRegionCode(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim().toUpperCase();
  if (!trimmed || trimmed.length > 64) return null;
  if (!/^[A-Z0-9_-]{1,64}$/.test(trimmed)) return null;
  return trimmed;
}

export function normalizeCityName(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  const city = trimmed.slice(0, 64);
  if (!/^[\p{L}\p{M}0-9 .,'()/-]+$/u.test(city)) return null;
  return city;
}

function stripMappedIpv6(ip: string): string {
  return ip.replace(/^::ffff:/i, "");
}

export function isPublicClientIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const value = stripMappedIpv6(ip.trim());
  if (!value) return false;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.some((octet) => octet > 255)) return false;
    const [a, b] = octets;
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    return true;
  }

  if (!value.includes(":")) return false;
  const lower = value.toLowerCase();
  if (lower === "::1" || lower === "::") return false;
  if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:")) return false;
  return true;
}

function firstPublicIp(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const ip = value?.trim();
    if (ip && isPublicClientIp(ip)) return stripMappedIpv6(ip);
  }
  return null;
}

/**
 * Client IP as seen by this app behind a single reverse proxy.
 * Prefers X-Real-IP, then the rightmost public address in X-Forwarded-For
 * (the hop the proxy added), so a client cannot spoof geo by sending its own
 * X-Forwarded-For header.
 */
export function clientIpFromHeaders(headerStore: { get(name: string): string | null }): string | null {
  const realIp = firstPublicIp([
    headerStore.get("x-real-ip"),
    headerStore.get("cf-connecting-ip"),
    headerStore.get("true-client-ip"),
  ]);
  if (realIp) return realIp;

  const forwarded = headerStore.get("x-forwarded-for");
  if (!forwarded) return null;

  const hops = forwarded.split(",").map((part) => part.trim()).reverse();
  return firstPublicIp(hops);
}

export function lookupGeoFromIp(ip: string | null | undefined, lookup: GeoIpLookup = lookupGeoFromLocalDatabase): VisitorGeo {
  if (!ip || !isPublicClientIp(ip)) return EMPTY_GEO;
  try {
    const hit = lookup(stripMappedIpv6(ip.trim()));
    return {
      country: normalizeCountryCode(hit.country),
      region: normalizeRegionCode(hit.region),
      city: normalizeCityName(hit.city),
    };
  } catch {
    return EMPTY_GEO;
  }
}

function lookupGeoFromLocalDatabase(ip: string): VisitorGeo {
  const geoip = loadGeoIpLite();
  if (!geoip) return EMPTY_GEO;
  const hit = geoip.lookup(ip);
  if (!hit) return EMPTY_GEO;
  return {
    country: hit.country ?? null,
    region: hit.region ?? null,
    city: hit.city ?? null,
  };
}

export function resolveVisitorGeo(
  headerStore: { get(name: string): string | null },
  lookup: GeoIpLookup = lookupGeoFromLocalDatabase,
): VisitorGeo {
  const fromHeaders: VisitorGeo = {
    country: countryFromHeaders(headerStore),
    region: regionFromHeaders(headerStore),
    city: cityFromHeaders(headerStore),
  };

  if (fromHeaders.country && fromHeaders.region && fromHeaders.city) {
    return fromHeaders;
  }

  const fromIp = lookupGeoFromIp(clientIpFromHeaders(headerStore), lookup);
  return {
    country: fromHeaders.country ?? fromIp.country,
    region: fromHeaders.region ?? fromIp.region,
    city: fromHeaders.city ?? fromIp.city,
  };
}

export function visitorContextFromHeaders(headerStore: { get(name: string): string | null }) {
  return {
    ip: clientIpFromHeaders(headerStore),
    ...resolveVisitorGeo(headerStore),
  };
}

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  UK: "United Kingdom",
  DE: "Germany",
  FR: "France",
  AU: "Australia",
  NL: "Netherlands",
  IT: "Italy",
  ES: "Spain",
  PL: "Poland",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  IE: "Ireland",
  BE: "Belgium",
  AT: "Austria",
  CH: "Switzerland",
  CZ: "Czechia",
  SK: "Slovakia",
  HU: "Hungary",
  RO: "Romania",
  PT: "Portugal",
  GR: "Greece",
  JP: "Japan",
  KR: "South Korea",
  CN: "China",
  IN: "India",
  BR: "Brazil",
  MX: "Mexico",
  NZ: "New Zealand",
  SG: "Singapore",
  AE: "United Arab Emirates",
  IL: "Israel",
  ZA: "South Africa",
};

export function countryDisplayName(code: string | null | undefined): string {
  if (!code || code === "unknown") return "Unknown";
  const normalized = code.trim().toUpperCase();
  return COUNTRY_NAMES[normalized] ?? normalized;
}

export function cityDisplayName(city: string | null | undefined): string {
  const normalized = normalizeCityName(city);
  return normalized ?? "Unknown";
}
