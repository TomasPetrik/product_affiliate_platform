export const DATE_RANGE_PRESETS = ["today", "yesterday", "7d", "30d", "90d", "custom"] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

export interface ResolvedDateRange {
  preset: DateRangePreset;
  start: Date;
  end: Date;
  fromParam: string;
  toParam: string;
}

export interface DateRangeSearchParams {
  range?: string;
  from?: string;
  to?: string;
  country?: string;
  source?: string;
  medium?: string;
  campaign?: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

export function parseIsoDate(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function eachUtcDay(start: Date, end: Date): string[] {
  const days: string[] = [];
  const cursor = startOfUtcDay(start);
  const last = startOfUtcDay(end);

  while (cursor.getTime() <= last.getTime()) {
    days.push(formatIsoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

export function isDateRangePreset(value: string | undefined): value is DateRangePreset {
  return DATE_RANGE_PRESETS.includes(value as DateRangePreset);
}

export function resolveDateRange(params: DateRangeSearchParams): ResolvedDateRange {
  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const preset = isDateRangePreset(params.range) ? params.range : "30d";

  if (preset === "custom") {
    const from = parseIsoDate(params.from) ?? new Date(todayStart.getTime() - 29 * MS_PER_DAY);
    const to = parseIsoDate(params.to) ?? todayStart;
    const start = from.getTime() <= to.getTime() ? from : to;
    const endDay = from.getTime() <= to.getTime() ? to : from;

    return {
      preset,
      start,
      end: endOfUtcDay(endDay),
      fromParam: formatIsoDate(start),
      toParam: formatIsoDate(endDay),
    };
  }

  const start =
    preset === "today"
      ? todayStart
      : preset === "yesterday"
        ? new Date(todayStart.getTime() - MS_PER_DAY)
        : preset === "7d"
          ? new Date(todayStart.getTime() - 6 * MS_PER_DAY)
          : preset === "90d"
            ? new Date(todayStart.getTime() - 89 * MS_PER_DAY)
            : new Date(todayStart.getTime() - 29 * MS_PER_DAY);

  const end = preset === "yesterday" ? endOfUtcDay(start) : now;

  return {
    preset,
    start,
    end,
    fromParam: formatIsoDate(start),
    toParam: formatIsoDate(preset === "yesterday" ? start : todayStart),
  };
}

export function dateRangeLabel(range: ResolvedDateRange): string {
  if (range.preset === "today") return "Today";
  if (range.preset === "yesterday") return "Yesterday";
  if (range.preset === "7d") return "Last 7 days";
  if (range.preset === "30d") return "Last 30 days";
  if (range.preset === "90d") return "Last 90 days";
  return `${range.fromParam} → ${range.toParam}`;
}
