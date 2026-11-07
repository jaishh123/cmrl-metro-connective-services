import { useEffect, type ReactNode } from 'react';

export function Spinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />{label}
    </div>
  );
}

export function Notice({ kind, children, onClose }: { kind: 'error' | 'success' | 'info'; children: ReactNode; onClose?: () => void }) {
  const style = { error: 'border-rose-200 bg-rose-50 text-rose-800', success: 'border-emerald-200 bg-emerald-50 text-emerald-800', info: 'border-sky-200 bg-sky-50 text-sky-800' }[kind];
  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${style}`} role={kind === 'error' ? 'alert' : 'status'}>
      <div className="min-w-0 break-words">{children}</div>
      {onClose && <button className="shrink-0 font-semibold opacity-70 hover:opacity-100" onClick={onClose} aria-label="Dismiss">Close</button>}
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-sky-200 bg-sky-50/50 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {hint && <p className="mt-1 max-w-md text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Modal({ title, children, onClose, footer }: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-label={title}>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <div className="mt-3 text-sm text-slate-600">{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card px-4 py-3.5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/** Quiet train silhouette behind page content. */
export function TrainBackdrop() {
  return (
    <svg aria-hidden className="pointer-events-none fixed bottom-0 right-0 -z-0 hidden h-40 w-[640px] max-w-[60vw] text-sky-200 opacity-40 lg:block" viewBox="0 0 640 160" fill="currentColor">
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${i * 200 + 20} 40)`}>
          <rect width="190" height="70" rx="18" />
          <g fill="white" opacity=".9">{[0, 1, 2, 3].map((j) => <rect key={j} x={14 + j * 42} y="14" width="30" height="22" rx="4" />)}</g>
          <rect x="0" y="48" width="190" height="6" fill="white" opacity=".6" />
          <circle cx="40" cy="76" r="7" /><circle cx="150" cy="76" r="7" />
        </g>
      ))}
      <rect x="0" y="124" width="640" height="4" /><rect x="0" y="136" width="640" height="2" opacity=".6" />
    </svg>
  );
}
