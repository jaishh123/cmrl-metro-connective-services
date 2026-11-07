export type Unit = 'count' | 'inr' | 'ratio';
export type Role = 'admin' | 'officer';

export interface Domain { id: string; name: string; is_enabled: boolean; sort_order: number }
export interface Metric {
  id: string; domain_id: string; code: string; label: string; unit: Unit;
  frequency: 'daily' | 'monthly'; allow_negative: boolean; allow_decimal: boolean; sort_order: number;
}
export interface DailyRow {
  id: string; domain_id: string; domain_name: string; domain_sort: number; metric_id: string;
  metric_code: string; metric_label: string; unit: Unit; metric_sort: number;
  record_date: string; value: number; cumulative_value: number; remarks: string | null; updated_at: string;
}
export interface MonthlyRow {
  id: string; domain_id: string; domain_name: string; domain_sort: number; metric_id: string;
  metric_code: string; metric_label: string; unit: Unit; metric_sort: number;
  month_start: string; value: number; remarks: string | null; updated_at: string;
}
export interface Filters { from: string; to: string; year: string; month: string; domainId: string; metricCode: string }
export const EMPTY_FILTERS: Filters = { from: '', to: '', year: '', month: '', domainId: '', metricCode: '' };
