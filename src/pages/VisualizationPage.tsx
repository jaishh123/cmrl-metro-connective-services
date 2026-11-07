import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { filterMonthly, loadDaily, loadDomains, loadMetrics, loadMonthlyAll } from '../lib/data';
import { averagePerDay, pivot } from '../lib/calc';
import { EMPTY_FILTERS, type DailyRow, type Domain, type Filters, type Metric, type MonthlyRow } from '../lib/types';
import { fmtDate, fmtMonth, fmtNum, fmtValue } from '../lib/format';
import FilterBar from '../components/FilterBar';
import { Empty, Notice, PageHeader, Spinner, Stat } from '../components/ui';

const PALETTE = ['#2468bd', '#0d9488', '#d97706', '#7c3aed', '#dc2626', '#059669', '#db2777', '#475569', '#0891b2', '#65a30d'];
const compact = (v: number) => new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
const monthLabel = (ym: string) => fmtMonth(`${ym}-01`);

function ChartCard({ title, note, empty, children }: { title: string; note?: string; empty: boolean; children: ReactNode }) {
  return (
    <section className="card p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
      <div className="mt-3 h-72">{empty ? <div className="flex h-full items-center"><div className="w-full"><Empty title="No data for the selected filters" hint="Add records on the Input page or widen the filters." /></div></div> : <ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer>}</div>
    </section>
  );
}

export default function VisualizationPage() {
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS); const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [domains, setDomains] = useState<Domain[]>([]); const [metrics, setMetrics] = useState<Metric[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]); const [monthlyAll, setMonthlyAll] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, m, dl, ml] = await Promise.all([loadDomains(), loadMetrics(), loadDaily(applied), loadMonthlyAll()]);
      setDomains(d); setMetrics(m); setDaily(dl); setMonthlyAll(ml); setError('');
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [applied]);
  useEffect(() => { load(); }, [load]);

  const color = useMemo(() => { const m = new Map<string, string>(); domains.forEach((d, i) => m.set(d.name, PALETTE[i % PALETTE.length])); return m; }, [domains]);
  const monthly = useMemo(() => filterMonthly(monthlyAll, applied), [monthlyAll, applied]);
  const asc = useMemo(() => [...daily].sort((a, b) => a.record_date.localeCompare(b.record_date)), [daily]);
  const code = (c: string, rows = asc) => rows.filter((r) => r.metric_code === c);

  const perf = code('daily_performance');
  const dailyPerf = pivot(perf, (r) => r.record_date, (r) => r.domain_name, (r) => r.value);
  const monthPerf = pivot(perf, (r) => r.record_date.slice(0, 7), (r) => r.domain_name, (r) => r.value);
  const yearPerf = pivot(perf, (r) => r.record_date.slice(0, 4), (r) => r.domain_name, (r) => r.value);
  const cumPerf = pivot(perf, (r) => r.record_date, (r) => r.domain_name, (r) => r.cumulative_value);
  const compare = useMemo(() => { const m = new Map<string, number>(); perf.forEach((r) => m.set(r.domain_name, (m.get(r.domain_name) ?? 0) + r.value)); return [...m].map(([name, total]) => ({ name, total })); }, [perf]);
  const ridership = pivot(code('ridership'), (r) => r.record_date, (r) => r.domain_name, (r) => r.value);
  const revenue = pivot(code('revenue'), (r) => r.record_date, (r) => r.domain_name, (r) => r.value);
  const gap = pivot(code('gap'), (r) => r.record_date, (r) => r.domain_name, (r) => r.value);
  const vehicles = pivot(code('vehicle_count'), (r) => r.record_date, (r) => r.domain_name, (r) => r.value);
  const parking = asc.filter((r) => r.domain_name.toLowerCase().includes('parking'));
  const parkRev = pivot(parking.filter((r) => r.metric_code === 'revenue'), (r) => r.record_date.slice(0, 7), (r) => r.domain_name, (r) => r.value);
  const parkVeh = pivot(parking.filter((r) => r.metric_code === 'vehicle_count'), (r) => r.record_date.slice(0, 7), (r) => r.domain_name, (r) => r.value);
  const mcode = (c: string) => monthly.filter((r) => r.metric_code === c);
  const alandur = useMemo(() => {
    const m = new Map<string, Record<string, number | string>>();
    for (const r of [...mcode('alandur_entry_monthly'), ...mcode('alandur_exit_monthly')]) { const k = r.month_start.slice(0, 7); const o = m.get(k) ?? { x: k }; o[r.metric_code === 'alandur_entry_monthly' ? 'Entry' : 'Exit'] = r.value; m.set(k, o); }
    return [...m.values()].sort((a, b) => String(a.x).localeCompare(String(b.x)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthly]);
  const pall = useMemo(() => {
    const m = new Map<string, Record<string, number | string>>(); const names: Record<string, string> = { monthly_revenue: 'Revenue generated', connectivity_expenditure: 'Connectivity expenditure', difference: 'Difference' };
    for (const r of monthly) if (names[r.metric_code]) { const k = r.month_start.slice(0, 7); const o = m.get(k) ?? { x: k }; o[names[r.metric_code]] = r.value; m.set(k, o); }
    return [...m.values()].sort((a, b) => String(a.x).localeCompare(String(b.x)));
  }, [monthly]);
  const pallTable = useMemo(() => {
    const m = new Map<string, Record<string, MonthlyRow>>();
    for (const r of monthly.filter((x) => x.domain_name === 'Pallavaram Parking')) { const k = r.month_start; const o = m.get(k) ?? {}; o[r.metric_code] = r; m.set(k, o); }
    return [...m].sort((a, b) => b[0].localeCompare(a[0]));
  }, [monthly]);

  const totals = useMemo(() => {
    const g = new Map<string, { domain: string; metric: string; unit: DailyRow['unit']; n: number; sum: number; last: string; sort: number }>();
    for (const r of daily) { const k = `${r.domain_id}|${r.metric_id}`; const e = g.get(k) ?? { domain: r.domain_name, metric: r.metric_label, unit: r.unit, n: 0, sum: 0, last: r.record_date, sort: r.domain_sort * 100 + r.metric_sort }; e.n++; e.sum += r.value; if (r.record_date > e.last) e.last = r.record_date; g.set(k, e); }
    return [...g.values()].sort((a, b) => a.sort - b.sort);
  }, [daily]);
  const dates = daily.map((r) => r.record_date).sort();

  const axisDate = { dataKey: 'x', tickFormatter: (v: string) => fmtDate(v).slice(0, 6), minTickGap: 40, fontSize: 11 };
  const axisMonth = { dataKey: 'x', tickFormatter: monthLabel, fontSize: 11, minTickGap: 20 };
  const tipDate = (v: unknown) => fmtDate(String(v)); const tipMonth = (v: unknown) => monthLabel(String(v));
  const lines = (s: string[]) => s.map((n) => <Line key={n} type="monotone" dataKey={n} name={n} stroke={color.get(n) ?? '#2468bd'} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />);
  const bars = (s: string[]) => s.map((n) => <Bar key={n} dataKey={n} name={n} fill={color.get(n) ?? '#2468bd'} radius={[3, 3, 0, 0]} isAnimationActive={false} />);
  const yAxis = <YAxis tickFormatter={compact} fontSize={11} width={52} />;
  const tip = (inr = false) => <Tooltip formatter={(v) => (typeof v === 'number' ? (inr ? '\u20B9' : '') + fmtNum(v) : String(v))} />;

  return (
    <>
      <PageHeader title="Visualization" subtitle="Charts and tables drawn from the saved records only. Choose filters, then press Apply filters." />
      <FilterBar value={draft} onChange={setDraft} domains={domains} metrics={metrics}>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <button className="btn-primary" onClick={() => setApplied(draft)}>Apply filters</button>
          <button className="btn-ghost" onClick={() => { setDraft(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); }}>Reset filters</button>
        </div>
      </FilterBar>
      {error && <div className="mt-4"><Notice kind="error">{error}</Notice></div>}
      {loading ? <Spinner label="Loading charts..." /> : (
        <div className="mt-4 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Daily records" value={fmtNum(daily.length)} />
            <Stat label="Monthly records" value={fmtNum(monthly.length)} />
            <Stat label="Domains with data" value={new Set([...daily, ...monthly].map((r) => r.domain_id)).size} />
            <Stat label="Daily date span" value={dates.length ? `${fmtDate(dates[0])} - ${fmtDate(dates.at(-1)!)}` : '-'} />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <ChartCard title="Daily performance" note="Daily Performance count per domain." empty={!dailyPerf.data.length}>
              <LineChart data={dailyPerf.data}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis {...axisDate} />{yAxis}<Tooltip labelFormatter={tipDate} /><Legend />{lines(dailyPerf.series)}</LineChart>
            </ChartCard>
            <ChartCard title="Daily cumulative performance" note="Month-to-date total. It starts again at the first of each month, as in the workbook." empty={!cumPerf.data.length}>
              <LineChart data={cumPerf.data}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis {...axisDate} />{yAxis}<Tooltip labelFormatter={tipDate} /><Legend />{lines(cumPerf.series)}</LineChart>
            </ChartCard>
            <ChartCard title="Monthly performance" note="Sum of the daily values entered in each month." empty={!monthPerf.data.length}>
              <BarChart data={monthPerf.data}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis {...axisMonth} />{yAxis}<Tooltip labelFormatter={tipMonth} /><Legend />{bars(monthPerf.series)}</BarChart>
            </ChartCard>
            <ChartCard title="Yearly performance" note="Sum of the daily values entered in each year." empty={!yearPerf.data.length}>
              <BarChart data={yearPerf.data}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="x" fontSize={11} />{yAxis}{tip()}<Legend />{bars(yearPerf.series)}</BarChart>
            </ChartCard>
            <ChartCard title="Domain-wise comparison" note="Total Daily Performance for the selected period." empty={!compare.length}>
              <BarChart data={compare}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" fontSize={11} />{yAxis}{tip()}<Bar dataKey="total" name="Total" radius={[3, 3, 0, 0]} isAnimationActive={false}>{compare.map((c) => <Cell key={c.name} fill={color.get(c.name) ?? '#2468bd'} />)}</Bar></BarChart>
            </ChartCard>
            <ChartCard title="MTC ridership" note="Daily ridership." empty={!ridership.data.length}>
              <LineChart data={ridership.data}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis {...axisDate} />{yAxis}<Tooltip labelFormatter={tipDate} /><Legend />{lines(ridership.series)}</LineChart>
            </ChartCard>
            <ChartCard title="SC-GBS Alandur ridership (monthly)" note="Monthly Alandur entry and exit. Monthly figures, kept apart from daily values." empty={!alandur.length}>
              <BarChart data={alandur}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis {...axisMonth} />{yAxis}<Tooltip labelFormatter={tipMonth} /><Legend /><Bar dataKey="Entry" fill="#2468bd" radius={[3, 3, 0, 0]} isAnimationActive={false} /><Bar dataKey="Exit" fill="#0d9488" radius={[3, 3, 0, 0]} isAnimationActive={false} /></BarChart>
            </ChartCard>
            <ChartCard title="Revenue" note="Daily revenue in rupees (MTC and the two parking domains)." empty={!revenue.data.length}>
              <LineChart data={revenue.data}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis {...axisDate} />{yAxis}{<Tooltip labelFormatter={tipDate} formatter={(v) => '\u20B9' + fmtNum(Number(v))} />}<Legend />{lines(revenue.series)}</LineChart>
            </ChartCard>
            <ChartCard title="MTC GAP" note="Daily GAP in rupees. It can be negative." empty={!gap.data.length}>
              <LineChart data={gap.data}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis {...axisDate} />{yAxis}<Tooltip labelFormatter={tipDate} formatter={(v) => '\u20B9' + fmtNum(Number(v))} /><ReferenceLine y={0} stroke="#94a3b8" />{lines(gap.series)}</LineChart>
            </ChartCard>
            <ChartCard title="Vehicle count" note="Daily vehicles at the parking domains." empty={!vehicles.data.length}>
              <LineChart data={vehicles.data}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis {...axisDate} />{yAxis}<Tooltip labelFormatter={tipDate} /><Legend />{lines(vehicles.series)}</LineChart>
            </ChartCard>
            <ChartCard title="Parking performance: vehicles per month" note="Sum of daily vehicle counts in each month." empty={!parkVeh.data.length}>
              <BarChart data={parkVeh.data}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis {...axisMonth} />{yAxis}<Tooltip labelFormatter={tipMonth} /><Legend />{bars(parkVeh.series)}</BarChart>
            </ChartCard>
            <ChartCard title="Parking performance: revenue per month" note="Sum of daily revenue in each month, in rupees." empty={!parkRev.data.length}>
              <BarChart data={parkRev.data}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis {...axisMonth} />{yAxis}<Tooltip labelFormatter={tipMonth} formatter={(v) => '\u20B9' + fmtNum(Number(v))} /><Legend />{bars(parkRev.series)}</BarChart>
            </ChartCard>
            <div className="xl:col-span-2">
              <ChartCard title="Pallavaram connectivity expenditure, revenue and difference" note="Monthly figures from the monthly entry form, in rupees. Difference can be negative." empty={!pall.length}>
                <ComposedChart data={pall}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis {...axisMonth} />{yAxis}<Tooltip labelFormatter={tipMonth} formatter={(v) => '\u20B9' + fmtNum(Number(v))} /><Legend /><ReferenceLine y={0} stroke="#94a3b8" />
                  <Bar dataKey="Revenue generated" fill="#2468bd" radius={[3, 3, 0, 0]} isAnimationActive={false} /><Bar dataKey="Connectivity expenditure" fill="#d97706" radius={[3, 3, 0, 0]} isAnimationActive={false} /><Line type="monotone" dataKey="Difference" stroke="#dc2626" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} /></ComposedChart>
              </ChartCard>
            </div>
          </div>

          <section className="card p-4">
            <h3 className="text-sm font-semibold text-slate-900">Totals by domain and metric</h3>
            <p className="mt-0.5 text-xs text-slate-500">Each metric is totalled separately. Counts, revenue and ridership are never added together.</p>
            {!totals.length ? <div className="mt-3"><Empty title="No daily records for the selected filters" /></div> : (
              <div className="mt-3 overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-sky-100"><th className="th">Domain</th><th className="th">Metric</th><th className="th text-right">Days recorded</th><th className="th text-right">Total</th><th className="th text-right">Average per recorded day</th><th className="th">Latest date</th></tr></thead>
                <tbody>{totals.map((t) => <tr key={t.domain + t.metric} className="border-b border-sky-50"><td className="td">{t.domain}</td><td className="td">{t.metric}</td><td className="td text-right">{fmtNum(t.n)}</td><td className="td text-right font-semibold">{fmtValue(t.sum, t.unit)}</td><td className="td text-right">{fmtValue(t.sum / t.n, t.unit)}</td><td className="td">{fmtDate(t.last)}</td></tr>)}</tbody></table></div>
            )}
          </section>

          <section className="card p-4">
            <h3 className="text-sm font-semibold text-slate-900">Pallavaram Parking: monthly table</h3>
            <p className="mt-0.5 text-xs text-slate-500">Monthly workbook figures. "Per day" uses the days counted for that month.</p>
            {!pallTable.length ? <div className="mt-3"><Empty title="No monthly Pallavaram records for the selected filters" /></div> : (
              <div className="mt-3 overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-sky-100"><th className="th">Month</th><th className="th text-right">Vehicle count</th><th className="th text-right">Vehicles per day</th><th className="th text-right">Revenue generated</th><th className="th text-right">Connectivity expenditure</th><th className="th text-right">Difference</th></tr></thead>
                <tbody>{pallTable.map(([m, o]) => {
                  const v = o.monthly_vehicle_count; const pd = v ? averagePerDay(v, monthlyAll) : null;
                  return <tr key={m} className="border-b border-sky-50"><td className="td">{fmtMonth(m)}</td><td className="td text-right">{v ? fmtValue(v.value, 'count') : '-'}</td><td className="td text-right">{pd === null ? '-' : fmtValue(pd, 'count')}</td><td className="td text-right">{o.monthly_revenue ? fmtValue(o.monthly_revenue.value, 'inr') : '-'}</td><td className="td text-right">{o.connectivity_expenditure ? fmtValue(o.connectivity_expenditure.value, 'inr') : '-'}</td><td className={`td text-right font-semibold ${o.difference && o.difference.value < 0 ? 'text-rose-600' : ''}`}>{o.difference ? fmtValue(o.difference.value, 'inr') : '-'}</td></tr>;
                })}</tbody></table></div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
