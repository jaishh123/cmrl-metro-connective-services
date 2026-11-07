import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Domain, Metric } from '../../lib/types';
import { existingMonthly, saveMonthly, type SaveRow } from '../../lib/data';
import { fmtMonth, parseInput } from '../../lib/format';
import { Notice } from '../ui';
import MetricField from './MetricField';

const prevMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const toDisplay = (v: number, m: Metric) => (m.unit === 'ratio' ? String(Number((v * 100).toFixed(4))) : String(v));

export default function MonthlyEntry({ domains, metrics, onSaved }: { domains: Domain[]; metrics: Metric[]; onSaved: () => void }) {
  const [month, setMonth] = useState(prevMonth());
  const [editExisting, setEditExisting] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<Map<string, number>>(new Map());
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success' | 'info'; text: string } | null>(null);
  const metricsRef = useRef(metrics); metricsRef.current = metrics;

  const withMonthly = useMemo(() => domains.filter((d) => d.is_enabled && metrics.some((m) => m.domain_id === d.id && m.frequency === 'monthly')), [domains, metrics]);
  const monthlyOf = (id: string) => metrics.filter((m) => m.domain_id === id && m.frequency === 'monthly');
  const start = `${month}-01`;

  const load = useCallback(async (announce: boolean) => {
    if (!month) return; setLoading(true);
    try {
      const rows = await existingMonthly(`${month}-01`);
      const v: Record<string, string> = {}; const r: Record<string, string> = {};
      for (const row of rows) { const m = metricsRef.current.find((x) => x.id === row.metric_id); if (!m) continue; v[m.id] = toDisplay(row.value, m); if (row.remarks && !r[m.domain_id]) r[m.domain_id] = row.remarks; }
      setValues(v); setRemarks(r); setExisting(new Map(rows.map((x) => [x.metric_id, x.value])));
      if (announce || rows.length) setMsg({ kind: 'info', text: rows.length ? `${rows.length} saved monthly value(s) loaded for ${fmtMonth(`${month}-01`)}.` : `No monthly data saved for ${fmtMonth(`${month}-01`)}.` }); else setMsg(null);
    } catch (e) { setMsg({ kind: 'error', text: (e as Error).message }); } finally { setLoading(false); }
  }, [month]);
  useEffect(() => { load(false); }, [load]);

  const save = async () => {
    setMsg(null);
    if (!month) return setMsg({ kind: 'error', text: 'Choose a month first.' });
    const rows: SaveRow[] = []; const errs: string[] = []; const conflicts: string[] = []; let unchanged = 0;
    for (const d of withMonthly) for (const m of monthlyOf(d.id)) {
      const raw = (values[m.id] ?? '').trim(); if (raw === '') continue;
      const p = parseInput(raw, m); if ('error' in p) { errs.push(`${d.name}: ${p.error}`); continue; }
      const rem = (remarks[d.id] ?? '').trim() || null; const ex = existing.get(m.id);
      if (ex !== undefined && ex === p.value) { unchanged++; continue; }
      if (ex !== undefined && !editExisting) { conflicts.push(`${d.name} - ${m.label}`); continue; }
      rows.push({ domain_id: d.id, metric_id: m.id, month_start: start, value: p.value, remarks: rem });
    }
    if (errs.length) return setMsg({ kind: 'error', text: errs.join(' ') });
    if (conflicts.length) return setMsg({ kind: 'error', text: `Monthly values already exist for ${fmtMonth(start)}: ${conflicts.join(', ')}. Tick "Edit existing values" to overwrite them.` });
    if (!rows.length) return setMsg({ kind: 'error', text: unchanged ? 'Nothing changed since the last save.' : 'Enter at least one monthly value before saving.' });
    setBusy(true);
    try { await saveMonthly(rows); await load(false); onSaved(); setMsg({ kind: 'success', text: `Saved ${rows.length} monthly value(s) for ${fmtMonth(start)}.` }); }
    catch (e) { setMsg({ kind: 'error', text: (e as Error).message }); } finally { setBusy(false); }
  };

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">Monthly entry</h2>
      <p className="mt-0.5 text-sm text-slate-500">Pallavaram Parking and SC-GBS also report monthly figures. These are stored separately from daily values and are never added to them.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="rmonth">Month</label><input id="rmonth" type="month" className="input w-48" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
        <button className="btn-ghost" onClick={() => load(true)} disabled={loading}>{loading ? 'Loading...' : 'Load existing month'}</button>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4 accent-sky-600" checked={editExisting} onChange={(e) => setEditExisting(e.target.checked)} />Edit existing values</label>
      </div>
      {msg && <div className="mt-4"><Notice kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Notice></div>}
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {withMonthly.map((d) => (
          <div key={d.id} className="rounded-xl border border-sky-100 bg-white p-4">
            <div className="mb-3 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-sky-600" /><h3 className="text-sm font-semibold text-slate-900">{d.name} (monthly)</h3></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {monthlyOf(d.id).map((m) => (
                <div key={m.id}>
                  <MetricField metric={m} value={values[m.id] ?? ''} saved={existing.get(m.id)} onChange={(v) => setValues((s) => ({ ...s, [m.id]: v }))} />
                  {m.code === 'avg_days' && <p className="mt-1 text-xs text-slate-400">Leave blank to use the calendar days of the month.</p>}
                </div>
              ))}
              <div className="sm:col-span-2"><label className="label" htmlFor={`mrem-${d.id}`}>Remarks (optional)</label><input id={`mrem-${d.id}`} className="input" value={remarks[d.id] ?? ''} onChange={(e) => setRemarks((s) => ({ ...s, [d.id]: e.target.value }))} /></div>
            </div>
          </div>
        ))}
        {!withMonthly.length && <p className="text-sm text-slate-500">No enabled domain has monthly fields.</p>}
      </div>
      <div className="mt-5 flex justify-end"><button className="btn-primary px-6" onClick={save} disabled={busy || !withMonthly.length}>{busy ? 'Saving...' : 'Save monthly data'}</button></div>
    </section>
  );
}
