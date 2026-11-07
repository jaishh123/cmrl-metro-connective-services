import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { TrainBackdrop } from './ui';

const NAV = [
  { to: '/input', label: 'Input', icon: 'M12 5v14M5 12h14' },
  { to: '/consolidation', label: 'Consolidation', icon: 'M4 6h16M4 12h16M4 18h16' },
  { to: '/visualization', label: 'Visualization', icon: 'M4 20V10M10 20V4M16 20v-8M22 20H2' },
];
const Icon = ({ d }: { d: string }) => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={d} /></svg>;

export default function Layout() {
  const { session, role, signOut } = useAuth();
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-sky-600 text-white shadow' : 'text-sky-100/80 hover:bg-navy-700/60 hover:text-white'}`;
  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="hidden w-64 shrink-0 flex-col bg-navy-900 p-4 text-white lg:flex">
        <div className="mb-8 flex items-center gap-3 px-1 pt-1">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-600 text-sm font-bold">MC</div>
          <div><p className="text-sm font-bold leading-tight">Metro Connect</p><p className="text-xs text-sky-200/70">Services Performance</p></div>
        </div>
        <p className="mb-2 px-3 text-xs font-medium text-sky-200/50">Workspace</p>
        <nav className="flex flex-col gap-1">{NAV.map((n) => <NavLink key={n.to} to={n.to} className={link}><Icon d={n.icon} />{n.label}</NavLink>)}</nav>
        <div className="mt-auto rounded-lg bg-navy-800 p-3 text-xs">
          <p className="truncate font-semibold text-white">{session?.user.email}</p>
          <p className="mb-2 mt-0.5 text-sky-200/70">Role: {role}</p>
          <button onClick={signOut} className="w-full rounded-md border border-navy-700 py-1.5 font-semibold text-sky-100 hover:bg-navy-700">Sign out</button>
        </div>
      </aside>
      <header className="flex items-center justify-between gap-2 bg-navy-900 px-3 py-2 text-white lg:hidden">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-sky-600 text-xs font-bold">MC</div>
        <nav className="flex gap-1">{NAV.map((n) => <NavLink key={n.to} to={n.to} className={({ isActive }) => `rounded-md px-2.5 py-1.5 text-xs font-semibold ${isActive ? 'bg-sky-600' : 'text-sky-100/80'}`}>{n.label}</NavLink>)}</nav>
        <button onClick={signOut} className="text-xs font-semibold text-sky-100">Sign out</button>
      </header>
      <main className="relative min-w-0 flex-1 overflow-y-auto">
        <TrainBackdrop />
        <div className="relative z-10 mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-8"><Outlet /></div>
      </main>
    </div>
  );
}
