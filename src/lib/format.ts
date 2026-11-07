import type { Unit } from './types';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function fmtValue(v: number | null | undefined, unit: Unit): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '-';
  if (unit === 'ratio') return (v * 100).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + '%';
  if (unit === 'inr') return '\u20B9' + v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
export const fmtNum = (v: number) => v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const fmtDate = (iso: string) => `${iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
export const fmtMonth = (iso: string) => `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
export const fmtStamp = (ts: string) => { const d = new Date(ts); return `${fmtDate(ts.slice(0, 10))}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`; };
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const daysInMonth = (monthStartIso: string) => new Date(Date.UTC(+monthStartIso.slice(0, 4), +monthStartIso.slice(5, 7), 0)).getUTCDate();
export const lastDayOfMonth = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;

/** Parse a typed number. Returns an error message or the number. */
export function parseInput(raw: string, o: { allow_negative: boolean; allow_decimal: boolean; label: string; unit: Unit }): { error: string } | { value: number } {
  let t = raw.trim().replace(/,/g, '');
  if (o.unit === 'ratio') t = t.replace(/%$/, '');
  if (t === '' || !/^-?\d*\.?\d+$/.test(t)) return { error: `${o.label}: "${raw}" is not a valid number.` };
  let n = Number(t);
  if (o.unit === 'ratio') n = Math.round((n / 100) * 1e6) / 1e6; // typed as %, stored as a fraction like the workbook
  if (n < 0 && !o.allow_negative) return { error: `${o.label}: negative values are not allowed.` };
  if (!o.allow_decimal && !Number.isInteger(n)) return { error: `${o.label}: only whole numbers are allowed.` };
  return { value: n };
}
