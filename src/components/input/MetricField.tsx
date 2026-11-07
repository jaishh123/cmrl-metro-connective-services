import type { Metric } from '../../lib/types';
import { fmtValue } from '../../lib/format';

const UNIT_HINT = { count: '', inr: '(\u20B9)', ratio: '(%)' } as const;

export default function MetricField({ metric, value, saved, onChange }: { metric: Metric; value: string; saved?: number; onChange: (v: string) => void }) {
  const id = `f-${metric.id}`;
  return (
    <div>
      <label className="label" htmlFor={id}>{metric.label} {UNIT_HINT[metric.unit]}</label>
      <input id={id} className="input" inputMode="decimal" autoComplete="off" placeholder="Enter value" value={value} onChange={(e) => onChange(e.target.value)} />
      {saved !== undefined && <p className="mt-1 text-xs text-sky-700">Saved value: {fmtValue(saved, metric.unit)}</p>}
    </div>
  );
}
