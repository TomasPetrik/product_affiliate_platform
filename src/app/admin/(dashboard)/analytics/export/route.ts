import { NextResponse } from "next/server";

import { parseAnalyticsFilters } from "@/lib/analytics-query";
import { resolveDateRange } from "@/lib/date-range";
import { getAdminSession } from "@/lib/auth";
import {
  canReadAnalytics,
  exportAnalyticsCsv,
  isAnalyticsExportType,
} from "@/server/services/analytics-export.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!canReadAnalytics(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (!isAnalyticsExportType(type)) {
    return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
  }

  const range = resolveDateRange({
    range: url.searchParams.get("range") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const filters = parseAnalyticsFilters({
    country: url.searchParams.get("country") ?? undefined,
    source: url.searchParams.get("source") ?? undefined,
    medium: url.searchParams.get("medium") ?? undefined,
    campaign: url.searchParams.get("campaign") ?? undefined,
  });

  const { filename, csv } = await exportAnalyticsCsv(type, range, filters);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
