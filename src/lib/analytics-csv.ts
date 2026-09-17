export const ANALYTICS_EXPORT_TYPES = ["products", "clicks", "countries", "campaigns"] as const;
export type AnalyticsExportType = (typeof ANALYTICS_EXPORT_TYPES)[number];

export function isAnalyticsExportType(value: string | null | undefined): value is AnalyticsExportType {
  return ANALYTICS_EXPORT_TYPES.includes(value as AnalyticsExportType);
}

function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n]/.test(raw)) return `"${raw.replaceAll('"', '""')}"`;
  return raw;
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  return [headers.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n");
}

export function canReadAnalytics(session: { sub?: string } | null | undefined): boolean {
  return Boolean(session?.sub);
}
