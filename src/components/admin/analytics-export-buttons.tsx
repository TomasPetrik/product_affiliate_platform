import { Button } from "@/components/ui/button";
import { analyticsQueryString, type AnalyticsQueryFilters } from "@/lib/analytics-query";
import type { ResolvedDateRange } from "@/lib/date-range";

const EXPORTS = [
  { type: "products", label: "Products CSV" },
  { type: "clicks", label: "Affiliate clicks CSV" },
  { type: "countries", label: "Countries CSV" },
  { type: "campaigns", label: "Campaigns CSV" },
] as const;

interface AnalyticsExportButtonsProps {
  range: ResolvedDateRange;
  filters?: AnalyticsQueryFilters;
}

export function AnalyticsExportButtons({ range, filters = {} }: AnalyticsExportButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {EXPORTS.map((item) => (
        <Button
          key={item.type}
          variant="outline"
          size="sm"
          nativeButton={false}
          render={
            <a
              href={`/admin/analytics/export${analyticsQueryString(range, filters, { type: item.type })}`}
              download
            />
          }
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
