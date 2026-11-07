import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { isConfigured } from './lib/supabase';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import LoginPage from './pages/LoginPage';
import InputPage from './pages/InputPage';
import ConsolidationPage from './pages/ConsolidationPage';
import VisualizationPage from './pages/VisualizationPage';

export default function App() {
  const { session, role, loading, profileError, signOut } = useAuth();

  if (!isConfigured) return (
    <div className="grid min-h-full place-items-center p-6"><div className="card max-w-lg p-6">
      <h1 className="text-lg font-bold">Supabase is not connected yet</h1>
      <p className="mt-2 text-sm text-slate-600">Create a file named <code className="rounded bg-slate-100 px-1">.env</code> next to <code className="rounded bg-slate-100 px-1">package.json</code> (copy <code className="rounded bg-slate-100 px-1">.env.example</code>), fill in <b>VITE_SUPABASE_URL</b> and <b>VITE_SUPABASE_ANON_KEY</b>, then restart. On Vercel, add the same two variables in Project Settings, then redeploy. The README explains each step.</p>
    </div></div>
  );
  if (loading) return <Spinner label="Checking your sign-in..." />;
  if (!session) return <LoginPage />;
  if (!role) return (
    <div className="grid min-h-full place-items-center p-6"><div className="card max-w-md p-6">
      <h1 className="text-lg font-bold">No access to this system</h1>
      <p className="mt-2 text-sm text-slate-600">{profileError ? `Could not read your profile: ${profileError}` : 'You are signed in, but your account has no active admin or officer role in the profiles table. Ask an administrator to add it.'}</p>
      <button className="btn-ghost mt-4" onClick={signOut}>Sign out</button>
    </div></div>
  );
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/input" element={<InputPage />} />
        <Route path="/consolidation" element={<ConsolidationPage />} />
        <Route path="/visualization" element={<VisualizationPage />} />
        <Route path="*" element={<Navigate to="/input" replace />} />
      </Route>
    </Routes>
  );
}
