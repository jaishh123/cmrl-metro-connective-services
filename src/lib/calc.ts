import type { MonthlyRow } from './types';
import { daysInMonth } from './format';

/** Pallavaram monthly figures that have an "Average per Day" in the workbook. */
const AVG_CODES = new Set(['monthly_vehicle_count', 'monthly_revenue', 'connectivity_expenditure', 'difference']);

/** Days used for averages: the stored "Days counted" value if present, otherwise the calendar days of the month. */
export function averagePerDay(row: MonthlyRow, all: MonthlyRow[]): number | null {
  if (!AVG_CODES.has(row.metric_code)) return null;
  const custom = all.find((r) => r.domain_id === row.domain_id && r.month_start === row.month_start && r.metric_code === 'avg_days');
  const days = custom ? custom.value : daysInMonth(row.month_start);
  return days > 0 ? row.value / days : null;
}

export function pivot<T>(rows: T[], x: (r: T) => string, s: (r: T) => string, v: (r: T) => number) {
  const byX = new Map<string, Record<string, number | string>>(); const series = new Set<string>();
  for (const r of rows) {
    const k = x(r), n = s(r); series.add(n);
    const o = byX.get(k) ?? { x: k }; o[n] = ((o[n] as number) ?? 0) + v(r); byX.set(k, o);
  }
  return { data: [...byX.values()].sort((a, b) => String(a.x).localeCompare(String(b.x))), series: [...series] };
}
