import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Domain, Metric } from '../../lib/types';
import { existingDaily, saveDaily, type SaveRow } from '../../lib/data';
import { fmtDate, parseInput, todayISO } from '../../lib/format';
import { Notice } from '../ui';
import MetricField from './MetricField';

type Ex = Map<string, { id: string; value: number; remarks: string | null }>;

export default function DailyEntry({ domains, metrics, management, onSaved }: { domains: Domain[]; metrics: Metric[]; management: ReactNode; onSaved: () => void }) {
  const [date, setDate] = useState(todayISO());
  const [editExisting, setEditExisting] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<Ex>(new Map());
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success' | 'info'; text: string } | null>(null);

  const metricsRef = useRef(metrics); metricsRef.current = metrics;
  const enabled = useMemo(() => domains.filter((d) => d.is_enabled), [domains]);
  const dailyOf = (id: string) => metrics.filter((m) => m.domain_id === id && m.frequency === 'daily');

  const load = useCallback(async (announce: boolean) => {
    if (!date) return;
    setLoading(true);
    try {
      const rows = await existingDaily(date);
      const v: Record<string, string> = {}; const r: Record<string, string> = {};
      for (const row of rows) { v[row.metric_id] = String(row.value); const m = metricsRef.current.find((x) => x.id === row.metric_id); if (m && row.remarks) r[m.domain_id] = row.remarks; }
      setExisting(new Map(rows.map((x) => [x.metric_id, x]))); setValues(v); setRemarks(r);
      if (announce || rows.length) setMsg(rows.length ? { kind: 'info', text: `${rows.length} saved value(s) loaded for ${fmtDate(date)}. Tick "Edit existing values" to change them.` } : { kind: 'info', text: `No saved data for ${fmtDate(date)}. Enter new values below.` });
      else setMsg(null);
    } catch (e) { setMsg({ kind: 'error', text: (e as Error).message }); } finally { setLoading(false); }
  }, [date]);
  useEffect(() => { load(false); }, [load]);

  const save = async () => {
    setMsg(null);
    if (!date) return setMsg({ kind: 'error', text: 'Choose a record date first.' });
    const rows: SaveRow[] = []; const errs: string[] = []; const conflicts: string[] = []; let unchanged = 0;
    for (const d of enabled) for (const m of dailyOf(d.id)) {
      const raw = (values[m.id] ?? '').trim(); if (raw === '') continue;
      const p = parseInput(raw, m); if ('error' in p) { errs.push(`${d.name}: ${p.error}`); continue; }
      const rem = (remarks[d.id] ?? '').trim() || null; const ex = existing.get(m.id);
      if (ex && ex.value === p.value && (ex.remarks ?? null) === rem) { unchanged++; continue; }
      if (ex && !editExisting) { conflicts.push(`${d.name} - ${m.label}`); continue; }
      rows.push({ domain_id: d.id, metric_id: m.id, record_date: date, value: p.value, remarks: rem });
    }
    if (errs.length) return setMsg({ kind: 'error', text: errs.join(' ') });
    if (conflicts.length) return setMsg({ kind: 'error', text: `Values already exist for ${fmtDate(date)}: ${conflicts.join(', ')}. Tick "Edit existing values" to overwrite them.` });
    if (!rows.length) return setMsg({ kind: 'error', text: unchanged ? 'Nothing changed since the last save.' : 'Enter at least one value before saving.' });
    setBusy(true);
    try { await saveDaily(rows); await load(false); onSaved(); setMsg({ kind: 'success', text: `Saved ${rows.length} value(s) for ${fmtDate(date)}. They now appear in Consolidation and Visualization.` }); }
    catch (e) { setMsg({ kind: 'error', text: (e as Error).message }); } finally { setBusy(false); }
  };

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">Daily performance entry</h2>
      <p className="mt-0.5 text-sm text-slate-500">Choose a date and fill in the figures you have. Leave unreported values blank; a blank is never saved as zero.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="rdate">Record date</label><input id="rdate" type="date" className="input w-48" value={date} max="2100-12-31" onChange={(e) => setDate(e.target.value)} /></div>
        <button className="btn-ghost" onClick={() => load(true)} disabled={loading}>{loading ? 'Loading...' : 'Load existing date'}</button>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4 accent-sky-600" checked={editExisting} onChange={(e) => setEditExisting(e.target.checked)} />Edit existing values</label>
      </div>
      {msg && <div className="mt-4"><Notice kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Notice></div>}
      <div className="mt-5">{management}</div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {enabled.map((d) => (
          <div key={d.id} className="rounded-xl border border-sky-100 bg-white p-4">
            <div className="mb-3 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-sky-600" /><h3 className="text-sm font-semibold text-slate-900">{d.name}</h3></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {dailyOf(d.id).map((m) => <MetricField key={m.id} metric={m} value={values[m.id] ?? ''} saved={existing.get(m.id)?.value} onChange={(v) => setValues((s) => ({ ...s, [m.id]: v }))} />)}
              <div className="sm:col-span-2"><label className="label" htmlFor={`rem-${d.id}`}>Remarks (optional)</label><input id={`rem-${d.id}`} className="input" value={remarks[d.id] ?? ''} onChange={(e) => setRemarks((s) => ({ ...s, [d.id]: e.target.value }))} placeholder="e.g. holiday, system outage" /></div>
            </div>
          </div>
        ))}
        {!enabled.length && <p className="text-sm text-slate-500">All domains are disabled. Enable a domain above to enter data.</p>}
      </div>
      <div className="mt-5 flex justify-end"><button className="btn-primary px-6" onClick={save} disabled={busy || !enabled.length}>{busy ? 'Saving...' : 'Save data'}</button></div>
    </section>
  );
}
