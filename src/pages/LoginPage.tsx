import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { Notice } from '../components/ui';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    const err = await signIn(email.trim(), password);
    if (err) setError(err === 'Invalid login credentials' ? 'Email or password is incorrect.' : err);
    setBusy(false);
  };
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-sky-600 font-bold">MC</div><span className="text-lg font-bold">Metro Connect</span></div>
        <div>
          <h2 className="max-w-md text-3xl font-bold leading-tight">One place for every service's daily performance.</h2>
          <p className="mt-3 max-w-md text-sky-200/80">Enter, review and visualise ridership, revenue and parking figures for all Metro Connect domains.</p>
        </div>
        <svg aria-hidden viewBox="0 0 640 120" className="w-full text-navy-700" fill="currentColor">
          {[0, 1, 2].map((i) => <g key={i} transform={`translate(${i * 210 + 10} 20)`}><rect width="200" height="70" rx="20" />{[0, 1, 2, 3].map((j) => <rect key={j} x={16 + j * 44} y="14" width="32" height="24" rx="5" fill="#12294f" />)}<circle cx="45" cy="78" r="8" /><circle cx="155" cy="78" r="8" /></g>)}
          <rect y="104" width="640" height="4" />
        </svg>
      </div>
      <div className="grid place-items-center p-6">
        <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
          <div><h1 className="text-xl font-bold text-slate-900">Sign in</h1><p className="mt-1 text-sm text-slate-500">Use your Metro Connect account.</p></div>
          {error && <Notice kind="error">{error}</Notice>}
          <div><label className="label" htmlFor="email">Email</label><input id="email" className="input" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className="label" htmlFor="pw">Password</label><input id="pw" className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}
