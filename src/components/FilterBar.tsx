import type { Domain, Filters, Metric } from '../lib/types';
import { MONTH_NAMES } from '../lib/format';

export function metricOptions(metrics: Metric[], frequency?: 'daily' | 'monthly') {
  const m = new Map<string, string>();
  for (const x of metrics) if (!frequency || x.frequency === frequency) if (!m.has(x.code)) m.set(x.code, x.label);
  return [...m].map(([code, label]) => ({ code, label }));
}

export default function FilterBar({ value, onChange, domains, metrics, frequency, search, onSearch, children }: {
  value: Filters; onChange: (f: Filters) => void; domains: Domain[]; metrics: Metric[]; frequency?: 'daily' | 'monthly';
  search?: string; onSearch?: (s: string) => void; children?: React.ReactNode;
}) {
  const set = (k: keyof Filters, v: string) => onChange({ ...value, [k]: v });
  const thisYear = new Date().getFullYear(); const years: number[] = []; for (let y = 2025; y <= thisYear + 1; y++) years.push(y);
  return (
    <div className="card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {onSearch && <div className="sm:col-span-2 xl:col-span-2"><label className="label" htmlFor="q">Search</label><input id="q" className="input" placeholder="Date, domain, metric, remarks" value={search} onChange={(e) => onSearch(e.target.value)} /></div>}
        <div><label className="label" htmlFor="from">Start date</label><input id="from" type="date" className="input" value={value.from} onChange={(e) => set('from', e.target.value)} /></div>
        <div><label className="label" htmlFor="to">End date</label><input id="to" type="date" className="input" value={value.to} onChange={(e) => set('to', e.target.value)} /></div>
        <div><label className="label" htmlFor="yr">Year</label><select id="yr" className="input" value={value.year} onChange={(e) => set('year', e.target.value)}><option value="">All years</option>{years.map((y) => <option key={y}>{y}</option>)}</select></div>
        <div><label className="label" htmlFor="mo">Month</label><select id="mo" className="input" value={value.month} onChange={(e) => set('month', e.target.value)}><option value="">All months</option>{MONTH_NAMES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}</select></div>
        <div><label className="label" htmlFor="dom">Domain</label><select id="dom" className="input" value={value.domainId} onChange={(e) => set('domainId', e.target.value)}><option value="">All domains</option>{domains.map((d) => <option key={d.id} value={d.id}>{d.name}{d.is_enabled ? '' : ' (disabled)'}</option>)}</select></div>
        <div><label className="label" htmlFor="met">Metric</label><select id="met" className="input" value={value.metricCode} onChange={(e) => set('metricCode', e.target.value)}><option value="">All metrics</option>{metricOptions(metrics, frequency).map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}</select></div>
        {children}
      </div>
    </div>
  );
}
