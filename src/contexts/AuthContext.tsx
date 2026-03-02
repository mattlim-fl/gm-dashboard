import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Enums } from '@/integrations/supabase/types';

type StaffRole = Enums<'staff_role'> | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  accessAllowed: boolean;
  role: StaffRole;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(false);
  const [role, setRole] = useState<StaffRole>(null);

  const loadAccess = async (nextUser: User | null) => {
    if (!nextUser?.email) {
      setAccessAllowed(false);
      setRole(null);
      return;
    }

    const { data, error } = await supabase
      .from('allowed_emails')
      .select('role')
      .eq('email', nextUser.email)
      .maybeSingle();

    if (error) {
      setAccessAllowed(false);
      setRole(null);
      return;
    }

    if (!data) {
      setAccessAllowed(false);
      setRole(null);
      return;
    }

    setAccessAllowed(true);
    setRole(data.role as StaffRole);
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        const nextUser = session?.user ?? null;
        setUser(nextUser);
        setLoading(true);
        loadAccess(nextUser).finally(() => setLoading(false));
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        setLoading(true);
        await loadAccess(nextUser);
      } else {
        setAccessAllowed(false);
        setRole(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setAccessAllowed(false);
    setRole(null);
  };

  const value = {
    user,
    session,
    loading,
    accessAllowed,
    role,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
