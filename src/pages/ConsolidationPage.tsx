import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteRecord, filterMonthly, loadDaily, loadDomains, loadMetrics, loadMonthlyAll, updateRecord } from '../lib/data';
import { averagePerDay } from '../lib/calc';
import { useAuth } from '../lib/auth';
import { EMPTY_FILTERS, type DailyRow, type Domain, type Filters, type Metric, type MonthlyRow } from '../lib/types';
import { fmtDate, fmtMonth, fmtNum, fmtStamp, fmtValue, parseInput } from '../lib/format';
import FilterBar from '../components/FilterBar';
import { Empty, Modal, Notice, PageHeader, Spinner, Stat } from '../components/ui';

type Tab = 'daily' | 'monthly';
const PAGE = 50;
interface Target { table: 'daily_records' | 'monthly_records'; id: string; label: string; metric: Metric; value: number; remarks: string | null }

export default function ConsolidationPage() {
  const { role } = useAuth();
  const [tab, setTab] = useState<Tab>('daily');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [search, setSearch] = useState(''); const [page, setPage] = useState(0);
  const [domains, setDomains] = useState<Domain[]>([]); const [metrics, setMetrics] = useState<Metric[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]); const [monthlyAll, setMonthlyAll] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Target | null>(null); const [deleting, setDeleting] = useState<Target | null>(null);
  const [editValue, setEditValue] = useState(''); const [editRemarks, setEditRemarks] = useState('');
  const [modalError, setModalError] = useState(''); const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [d, m, dl, ml] = await Promise.all([loadDomains(), loadMetrics(), loadDaily(filters), loadMonthlyAll()]);
      setDomains(d); setMetrics(m); setDaily(dl); setMonthlyAll(ml); setError('');
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [filters]);
  useEffect(() => { reload(); setPage(0); }, [reload]);
  useEffect(() => setPage(0), [search, tab]);

  const q = search.trim().toLowerCase();
  const dailyRows = useMemo(() => daily.filter((r) => !q || `${r.record_date} ${fmtDate(r.record_date)} ${r.domain_name} ${r.metric_label} ${r.remarks ?? ''}`.toLowerCase().includes(q)), [daily, q]);
  const monthlyRows = useMemo(() => filterMonthly(monthlyAll, filters).filter((r) => !q || `${r.month_start} ${fmtMonth(r.month_start)} ${r.domain_name} ${r.metric_label} ${r.remarks ?? ''}`.toLowerCase().includes(q)), [monthlyAll, filters, q]);

  const rows: (DailyRow | MonthlyRow)[] = tab === 'daily' ? dailyRows : monthlyRows;
  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));

  const summary = useMemo(() => {
    const dates = tab === 'daily' ? dailyRows.map((r) => r.record_date) : monthlyRows.map((r) => r.month_start);
    const stamps = rows.map((r) => r.updated_at).sort();
    return { span: dates.length ? [dates.reduce((a, b) => (a < b ? a : b)), dates.reduce((a, b) => (a > b ? a : b))] : null, domains: new Set(rows.map((r) => r.domain_id)).size, last: stamps.at(-1) };
  }, [rows, dailyRows, monthlyRows, tab]);

  // Totals are calculated per domain AND per metric. Different metrics/units are never added together.
  const totals = useMemo(() => {
    const g = new Map<string, { domain: string; metric: string; unit: DailyRow['unit']; n: number; sum: number; sort: number }>();
    for (const r of dailyRows) {
      const k = `${r.domain_id}|${r.metric_id}`; const e = g.get(k) ?? { domain: r.domain_name, metric: r.metric_label, unit: r.unit, n: 0, sum: 0, sort: r.domain_sort * 100 + r.metric_sort };
      e.n++; e.sum += r.value; g.set(k, e);
    }
    return [...g.values()].sort((a, b) => a.sort - b.sort);
  }, [dailyRows]);

  const openEdit = (r: DailyRow | MonthlyRow) => {
    const metric = metrics.find((m) => m.id === r.metric_id); if (!metric) return;
    const isDaily = 'record_date' in r;
    setEditing({ table: isDaily ? 'daily_records' : 'monthly_records', id: r.id, label: `${r.domain_name} - ${r.metric_label} - ${isDaily ? fmtDate(r.record_date) : fmtMonth(r.month_start)}`, metric, value: r.value, remarks: r.remarks });
    setEditValue(metric.unit === 'ratio' ? String(Number((r.value * 100).toFixed(4))) : String(r.value)); setEditRemarks(r.remarks ?? ''); setModalError('');
  };
  const saveEdit = async () => {
    if (!editing) return;
    const p = parseInput(editValue, editing.metric); if ('error' in p) return setModalError(p.error);
    setBusy(true); setModalError('');
    try { await updateRecord(editing.table, editing.id, p.value, editRemarks.trim() || null); setNotice('Record updated. Cumulative values and charts now reflect the change.'); setEditing(null); await reload(); }
    catch (e) { setModalError((e as Error).message); } finally { setBusy(false); }
  };
  const confirmDelete = async () => {
    if (!deleting) return; setBusy(true); setModalError('');
    try { await deleteRecord(deleting.table, deleting.id); setNotice('Record deleted. Cumulative values and charts now reflect the change.'); setDeleting(null); await reload(); }
    catch (e) { setModalError((e as Error).message); } finally { setBusy(false); }
  };
  const asTarget = (r: DailyRow | MonthlyRow): Target | null => {
    const metric = metrics.find((m) => m.id === r.metric_id); if (!metric) return null; const d = 'record_date' in r;
    return { table: d ? 'daily_records' : 'monthly_records', id: r.id, label: `${r.domain_name} - ${r.metric_label} - ${d ? fmtDate(r.record_date) : fmtMonth(r.month_start)}`, metric, value: r.value, remarks: r.remarks };
  };

  return (
    <>
      <PageHeader title="Consolidation" subtitle="Every value saved on the Input page, in one table. Cumulative values are month-to-date and are recalculated after each change." />
      <div className="mb-4 inline-flex rounded-lg border border-sky-200 bg-white p-1">
        {(['daily', 'monthly'] as Tab[]).map((t) => <button key={t} onClick={() => { setTab(t); setFilters((f) => ({ ...f, metricCode: '' })); }} className={`rounded-md px-4 py-1.5 text-sm font-semibold ${tab === t ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-sky-50'}`}>{t === 'daily' ? 'Daily records' : 'Monthly records'}</button>)}
      </div>
      <FilterBar value={filters} onChange={setFilters} domains={domains} metrics={metrics} frequency={tab} search={search} onSearch={setSearch}>
        <div className="flex items-end gap-2"><button className="btn-ghost" onClick={() => { setFilters(EMPTY_FILTERS); setSearch(''); }}>Reset filters</button><button className="btn-ghost" onClick={reload}>Refresh</button></div>
      </FilterBar>
      {notice && <div className="mt-4"><Notice kind="success" onClose={() => setNotice('')}>{notice}</Notice></div>}
      {error && <div className="mt-4"><Notice kind="error">{error}</Notice></div>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={tab === 'daily' ? 'Daily records shown' : 'Monthly records shown'} value={fmtNum(rows.length)} />
        <Stat label="Date span" value={summary.span ? (tab === 'daily' ? `${fmtDate(summary.span[0])} - ${fmtDate(summary.span[1])}` : `${fmtMonth(summary.span[0])} - ${fmtMonth(summary.span[1])}`) : '-'} />
        <Stat label="Domains with records" value={summary.domains} />
        <Stat label="Last update" value={summary.last ? fmtStamp(summary.last) : '-'} />
      </div>
      {tab === 'daily' && totals.length > 0 && (
        <details className="card mt-4 p-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">Totals by domain and metric (for the rows shown)</summary>
          <p className="mt-1 text-xs text-slate-500">Each metric is totalled on its own, so counts, revenue and ridership are never mixed.</p>
          <div className="mt-3 overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-sky-100"><th className="th">Domain</th><th className="th">Metric</th><th className="th text-right">Days recorded</th><th className="th text-right">Total</th><th className="th text-right">Average per recorded day</th></tr></thead>
            <tbody>{totals.map((t) => <tr key={t.domain + t.metric} className="border-b border-sky-50"><td className="td">{t.domain}</td><td className="td">{t.metric}</td><td className="td text-right">{fmtNum(t.n)}</td><td className="td text-right font-semibold">{fmtValue(t.sum, t.unit)}</td><td className="td text-right">{fmtValue(t.sum / t.n, t.unit)}</td></tr>)}</tbody></table></div>
        </details>
      )}
      <div className="card mt-4 overflow-hidden">
        {loading ? <Spinner /> : !rows.length ? <div className="p-6"><Empty title="No records match these filters" hint="Change or reset the filters, or add data on the Input page." /></div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-sky-50"><tr>
                <th className="th">{tab === 'daily' ? 'Date' : 'Month'}</th><th className="th">Domain / Service</th><th className="th">Metric</th>
                <th className="th text-right">{tab === 'daily' ? 'Daily value' : 'Monthly value'}</th><th className="th text-right">{tab === 'daily' ? 'Cumulative (month-to-date)' : 'Average per day'}</th>
                <th className="th">Remarks</th><th className="th">Last updated</th><th className="th text-right">Actions</th></tr></thead>
              <tbody>
                {pageRows.map((r) => {
                  const d = 'record_date' in r; const t = asTarget(r);
                  return (
                    <tr key={r.id} className="border-t border-sky-50 hover:bg-sky-50/40">
                      <td className="td whitespace-nowrap">{d ? fmtDate(r.record_date) : fmtMonth(r.month_start)}</td>
                      <td className="td">{r.domain_name}</td><td className="td">{r.metric_label}</td>
                      <td className="td text-right font-semibold">{fmtValue(r.value, r.unit)}</td>
                      <td className="td text-right text-slate-600">{d ? fmtValue(r.cumulative_value, r.unit) : (() => { const a = averagePerDay(r as MonthlyRow, monthlyAll); return a === null ? '-' : fmtValue(a, r.unit); })()}</td>
                      <td className="td max-w-[200px] truncate text-slate-500" title={r.remarks ?? ''}>{r.remarks || '-'}</td>
                      <td className="td whitespace-nowrap text-xs text-slate-500">{fmtStamp(r.updated_at)}</td>
                      <td className="td whitespace-nowrap text-right">
                        <button className="btn-ghost btn-sm" onClick={() => openEdit(r)}>Edit</button>
                        {role === 'admin' && t && <button className="btn-danger btn-sm ml-1.5" onClick={() => { setModalError(''); setDeleting(t); }}>Delete</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && rows.length > PAGE && (
          <div className="flex items-center justify-between border-t border-sky-100 px-4 py-3 text-sm text-slate-600">
            <span>Showing {page * PAGE + 1}-{Math.min(rows.length, page * PAGE + PAGE)} of {fmtNum(rows.length)}</span>
            <span className="flex items-center gap-2"><button className="btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>Page {page + 1} of {pages}<button className="btn-ghost btn-sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button></span>
          </div>
        )}
      </div>
      {editing && (
        <Modal title="Edit record" onClose={() => setEditing(null)} footer={<><button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn-primary" disabled={busy} onClick={saveEdit}>{busy ? 'Saving...' : 'Save changes'}</button></>}>
          <p className="mb-3 font-medium text-slate-800">{editing.label}</p>
          <label className="label" htmlFor="ev">{editing.metric.label} {editing.metric.unit === 'inr' ? '(\u20B9)' : editing.metric.unit === 'ratio' ? '(%)' : ''}</label>
          <input id="ev" className="input" inputMode="decimal" value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
          <label className="label mt-3" htmlFor="er">Remarks</label>
          <input id="er" className="input" value={editRemarks} onChange={(e) => setEditRemarks(e.target.value)} />
          {modalError && <div className="mt-3"><Notice kind="error">{modalError}</Notice></div>}
        </Modal>
      )}
      {deleting && (
        <Modal title="Delete this record?" onClose={() => setDeleting(null)} footer={<><button className="btn-ghost" onClick={() => setDeleting(null)}>Cancel</button><button className="btn-danger" disabled={busy} onClick={confirmDelete}>{busy ? 'Deleting...' : 'Delete record'}</button></>}>
          <p className="font-medium text-slate-800">{deleting.label}</p>
          <p className="mt-2">Value: {fmtValue(deleting.value, deleting.metric.unit)}. This cannot be undone, and cumulative values will be recalculated.</p>
          {modalError && <div className="mt-3"><Notice kind="error">{modalError}</Notice></div>}
        </Modal>
      )}
    </>
  );
}
