import { pms } from './supabase';
import type { DailyRow, Domain, Filters, Metric, MonthlyRow } from './types';

const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

/** Supabase returns at most 1000 rows per request, so read page by page. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAll<T>(make: () => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make().range(from, from + 999);
    fail(error);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function loadDomains(): Promise<Domain[]> {
  const { data, error } = await pms().from('domains').select('*').order('sort_order').order('name');
  fail(error); return (data ?? []) as Domain[];
}
export async function loadMetrics(): Promise<Metric[]> {
  const { data, error } = await pms().from('metric_definitions').select('*').order('sort_order');
  fail(error); return (data ?? []) as Metric[];
}

/** Date range from the Start/End dates plus the Year/Month filters. */
function range(f: Filters): { lo: string; hi: string } {
  let lo = f.from, hi = f.to;
  if (f.year) {
    const y = f.year;
    if (!lo || lo < `${y}-01-01`) lo = `${y}-01-01`;
    if (!hi || hi > `${y}-12-31`) hi = `${y}-12-31`;
  }
  return { lo, hi };
}
const monthOk = (iso: string, f: Filters) => !f.month || iso.slice(5, 7) === f.month.padStart(2, '0');

export async function loadDaily(f: Filters): Promise<DailyRow[]> {
  const { lo, hi } = range(f);
  const rows = await fetchAll<DailyRow>(() => {
    let q = pms().from('v_daily').select('*');
    if (lo) q = q.gte('record_date', lo);
    if (hi) q = q.lte('record_date', hi);
    if (f.domainId) q = q.eq('domain_id', f.domainId);
    if (f.metricCode) q = q.eq('metric_code', f.metricCode);
    return q.order('record_date', { ascending: false }).order('domain_sort').order('metric_sort').order('id');
  });
  return rows.filter((r) => monthOk(r.record_date, f));
}

/** Monthly data is small, so it is loaded whole and filtered in the browser (needed for Average per Day). */
export async function loadMonthlyAll(): Promise<MonthlyRow[]> {
  return fetchAll<MonthlyRow>(() => pms().from('v_monthly').select('*').order('month_start', { ascending: false }).order('domain_sort').order('metric_sort').order('id'));
}
export function filterMonthly(rows: MonthlyRow[], f: Filters): MonthlyRow[] {
  const { lo, hi } = range(f);
  return rows.filter((r) =>
    (!lo || r.month_start >= lo.slice(0, 7) + '-01') && (!hi || r.month_start <= hi) &&
    (!f.domainId || r.domain_id === f.domainId) && (!f.metricCode || r.metric_code === f.metricCode) && monthOk(r.month_start, f));
}

export async function addDomain(name: string) {
  const { error } = await pms().rpc('add_domain', { p_name: name });
  if (error) throw new Error(error.code === '23505' ? `A domain named "${name.trim()}" already exists.` : error.message);
}
export async function setDomainEnabled(id: string, enabled: boolean) {
  const { data, error } = await pms().from('domains').update({ is_enabled: enabled }).eq('id', id).select('id');
  fail(error); if (!data?.length) throw new Error('Not allowed. Only an admin can enable or disable domains.');
}
export async function domainRecordCount(id: string): Promise<number> {
  const a = await pms().from('daily_records').select('id', { count: 'exact', head: true }).eq('domain_id', id);
  const b = await pms().from('monthly_records').select('id', { count: 'exact', head: true }).eq('domain_id', id);
  fail(a.error); fail(b.error); return (a.count ?? 0) + (b.count ?? 0);
}
export async function deleteDomain(id: string) {
  const n = await domainRecordCount(id);
  if (n > 0) throw new Error(`This domain has ${n} saved record(s) and cannot be deleted. Disable it instead.`);
  const { data, error } = await pms().from('domains').delete().eq('id', id).select('id');
  fail(error); if (!data?.length) throw new Error('Not allowed. Only an admin can delete domains.');
}

export interface SaveRow { domain_id: string; metric_id: string; value: number; remarks: string | null; record_date?: string; month_start?: string }
export async function saveDaily(rows: SaveRow[]) {
  const { error } = await pms().from('daily_records').upsert(rows, { onConflict: 'metric_id,record_date' });
  fail(error);
}
export async function saveMonthly(rows: SaveRow[]) {
  const { error } = await pms().from('monthly_records').upsert(rows, { onConflict: 'metric_id,month_start' });
  fail(error);
}
export async function existingDaily(date: string) {
  const { data, error } = await pms().from('daily_records').select('id,metric_id,value,remarks').eq('record_date', date);
  fail(error); return (data ?? []) as { id: string; metric_id: string; value: number; remarks: string | null }[];
}
export async function existingMonthly(month: string) {
  const { data, error } = await pms().from('monthly_records').select('id,metric_id,value,remarks').eq('month_start', month);
  fail(error); return (data ?? []) as { id: string; metric_id: string; value: number; remarks: string | null }[];
}
export async function updateRecord(table: 'daily_records' | 'monthly_records', id: string, value: number, remarks: string | null) {
  const { data, error } = await pms().from(table).update({ value, remarks }).eq('id', id).select('id');
  fail(error); if (!data?.length) throw new Error('The record could not be updated (it may have been deleted, or your role cannot edit).');
}
export async function deleteRecord(table: 'daily_records' | 'monthly_records', id: string) {
  const { data, error } = await pms().from(table).delete().eq('id', id).select('id');
  fail(error); if (!data?.length) throw new Error('Not allowed. Only an admin can delete records.');
}
