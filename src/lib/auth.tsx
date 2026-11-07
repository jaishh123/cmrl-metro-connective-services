import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Role } from './types';

interface AuthState {
  session: Session | null; role: Role | null; loading: boolean; profileError: string;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}
const Ctx = createContext<AuthState>(null as unknown as AuthState);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); if (!s) { setRole(null); setLoading(false); } });
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setLoading(true); setProfileError('');
    // Reads the existing public.profiles table (read-only) so old admin/officer roles keep working.
    supabase.schema('public').from('profiles').select('role,is_active').eq('id', uid).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setProfileError(error.message);
        else if (data && data.is_active !== false && (data.role === 'admin' || data.role === 'officer')) setRole(data.role as Role);
        else setRole(null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [uid]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  };
  const signOut = async () => { await supabase.auth.signOut(); };

  return <Ctx.Provider value={{ session, role, loading, profileError, signIn, signOut }}>{children}</Ctx.Provider>;
}
