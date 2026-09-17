"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DATE_RANGE_PRESETS, type DateRangePreset, type ResolvedDateRange } from "@/lib/date-range";

const PRESET_LABELS: Record<Exclude<DateRangePreset, "custom">, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

interface DateRangeFilterProps {
  basePath: string;
  range: ResolvedDateRange;
  extraParams?: {
    country?: string | null;
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    [key: string]: string | null | undefined;
  };
}

export function DateRangeFilter({ basePath, range, extraParams = {} }: DateRangeFilterProps) {
  const router = useRouter();

  function extras(): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(extraParams)) {
      if (value) params.set(key, value);
    }
    const query = params.toString();
    return query ? `&${query}` : "";
  }

  function pushPreset(preset: Exclude<DateRangePreset, "custom">) {
    router.push(`${basePath}?range=${preset}${extras()}`);
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-wrap gap-2">
        {DATE_RANGE_PRESETS.filter((preset) => preset !== "custom").map((preset) => (
          <Button
            key={preset}
            type="button"
            size="sm"
            variant={range.preset === preset ? "default" : "outline"}
            onClick={() => pushPreset(preset)}
          >
            {PRESET_LABELS[preset]}
          </Button>
        ))}
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        action={basePath}
        method="get"
      >
        <input type="hidden" name="range" value="custom" />
        {Object.entries(extraParams).map(([key, value]) =>
          value ? <input key={key} type="hidden" name={key} value={value} /> : null,
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="from" className="text-xs">
            From
          </Label>
          <Input id="from" name="from" type="date" defaultValue={range.fromParam} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="to" className="text-xs">
            To
          </Label>
          <Input id="to" name="to" type="date" defaultValue={range.toParam} required />
        </div>
        <Button
          type="submit"
          size="sm"
          variant={range.preset === "custom" ? "default" : "outline"}
          className={cn("sm:mb-0.5")}
        >
          Custom range
        </Button>
      </form>
    </div>
  );
}
