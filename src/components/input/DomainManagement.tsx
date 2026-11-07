import { useState, type FormEvent } from 'react';
import type { Domain } from '../../lib/types';
import { addDomain, deleteDomain, setDomainEnabled } from '../../lib/data';
import { Modal, Notice } from '../ui';

export default function DomainManagement({ domains, isAdmin, onChanged }: { domains: Domain[]; isAdmin: boolean; onChanged: () => Promise<void> }) {
  const [name, setName] = useState(''); const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [toDelete, setToDelete] = useState<Domain | null>(null); const [delError, setDelError] = useState('');

  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key); setMsg(null);
    try { await fn(); await onChanged(); setMsg({ kind: 'success', text: ok }); }
    catch (e) { setMsg({ kind: 'error', text: (e as Error).message }); }
    finally { setBusy(''); }
  };
  const add = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setMsg({ kind: 'error', text: 'Enter a domain name first.' });
    if (domains.some((d) => d.name.toLowerCase() === n.toLowerCase())) return setMsg({ kind: 'error', text: `"${n}" already exists.` });
    run('add', async () => { await addDomain(n); setName(''); }, `${n} added and enabled. It starts with one "Daily Performance" field.`);
  };
  const confirmDelete = async () => {
    if (!toDelete) return; setBusy('del'); setDelError('');
    try { await deleteDomain(toDelete.id); await onChanged(); setMsg({ kind: 'success', text: `${toDelete.name} deleted.` }); setToDelete(null); }
    catch (e) { setDelError((e as Error).message); } finally { setBusy(''); }
  };

  return (
    <section className="rounded-xl border border-sky-200 border-l-4 border-l-sky-500 bg-sky-50/60 p-5">
      <h3 className="text-base font-semibold text-slate-900">Domain management</h3>
      <p className="mt-0.5 text-sm text-slate-500">Disabled domains are hidden from data entry, but their history stays in Consolidation and Visualization. A domain can only be deleted if it has no records.</p>
      {isAdmin ? (
        <form onSubmit={add} className="mt-4 flex flex-wrap gap-2">
          <input className="input max-w-md flex-1" placeholder="New domain name (e.g. Guindy Metro)" value={name} onChange={(e) => setName(e.target.value)} aria-label="New domain name" />
          <button className="btn-primary" disabled={busy === 'add'}>{busy === 'add' ? 'Adding...' : 'Add domain'}</button>
        </form>
      ) : <div className="mt-4"><Notice kind="info">Only an admin can add, enable, disable or delete domains.</Notice></div>}
      {msg && <div className="mt-3"><Notice kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Notice></div>}
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {domains.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-sky-100 bg-white px-3 py-2.5">
            <span className="truncate text-sm font-semibold text-slate-800">{d.name}</span>
            <span className="flex shrink-0 items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d.is_enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{d.is_enabled ? 'Enabled' : 'Disabled'}</span>
              {isAdmin && <>
                <button className="btn-ghost btn-sm" disabled={busy === d.id} onClick={() => run(d.id, () => setDomainEnabled(d.id, !d.is_enabled), `${d.name} ${d.is_enabled ? 'disabled' : 'enabled'}.`)}>{d.is_enabled ? 'Disable' : 'Enable'}</button>
                <button className="btn-danger btn-sm" onClick={() => { setDelError(''); setToDelete(d); }}>Delete</button>
              </>}
            </span>
          </div>
        ))}
      </div>
      {toDelete && (
        <Modal title={`Delete ${toDelete.name}?`} onClose={() => setToDelete(null)} footer={<><button className="btn-ghost" onClick={() => setToDelete(null)}>Cancel</button><button className="btn-danger" disabled={busy === 'del'} onClick={confirmDelete}>{busy === 'del' ? 'Deleting...' : 'Delete domain'}</button></>}>
          <p>This permanently removes the domain and its field setup. It only works when the domain has no saved records.</p>
          {delError && <div className="mt-3"><Notice kind="error">{delError}</Notice></div>}
        </Modal>
      )}
    </section>
  );
}
