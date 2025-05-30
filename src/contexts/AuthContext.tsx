
"use client";

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import type { Session, User as SupabaseAuthUser, AuthError, SignInWithPasswordCredentials, SignUpWithPasswordCredentials } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import type { AuthUser, Pilot } from '@/types'; // Importar Pilot

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  login: (credentials: SignInWithPasswordCredentials) => Promise<{ error: AuthError | null }>;
  logout: () => Promise<{ error: AuthError | null }>;
  signUp: (credentials: SignUpWithPasswordCredentials) => Promise<{ data: { user: SupabaseAuthUser | null, session: Session | null }, error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getInitialSession = async () => {
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("Error al obtener la sesión inicial:", sessionError);
        // No set user/session here, let onAuthStateChange handle it or lack thereof.
        // setLoading(false); // onAuthStateChange should handle this for INITIAL_SESSION
        return;
      }

      if (currentSession) {
        // Fetch pilot profile if session exists
        const { data: pilotProfile, error: pilotError } = await supabase
          .from('pilots')
          .select('is_admin')
          .eq('auth_user_id', currentSession.user.id)
          .single();

        if (pilotError && pilotError.code !== 'PGRST116') { // PGRST116 means no rows, which is fine
          console.error("Error fetching pilot profile on initial session:", pilotError);
        }
        
        setUser({ 
          id: currentSession.user.id, 
          email: currentSession.user.email,
          is_admin: pilotProfile?.is_admin ?? false
        });
        setSession(currentSession);
      } else {
        setUser(null);
        setSession(null);
      }
      // setLoading(false); // Moved to onAuthStateChange for INITIAL_SESSION
    };

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (currentSession) {
        // Fetch pilot profile when auth state changes to a valid session
        const { data: pilotProfile, error: pilotError } = await supabase
          .from('pilots')
          .select('is_admin')
          .eq('auth_user_id', currentSession.user.id)
          .single();

        if (pilotError && pilotError.code !== 'PGRST116') { // Ignore "no rows" error, means no pilot profile yet
          console.error("Error fetching pilot profile on auth change:", pilotError);
        }

        setUser({ 
          id: currentSession.user.id, 
          email: currentSession.user.email,
          is_admin: pilotProfile?.is_admin ?? false
        });
        setSession(currentSession);
      } else {
        setUser(null);
        setSession(null);
      }

      if (_event === 'INITIAL_SESSION') {
        setLoading(false);
      } else if (_event === 'SIGNED_IN' && loading) {
        setLoading(false);
      } else if (_event === 'SIGNED_OUT') {
        setLoading(false); // Ensure loading is false on sign out
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []); // Empty dependency array means this effect runs once on mount

  const login = async (credentials: SignInWithPasswordCredentials) => {
    const { error } = await supabase.auth.signInWithPassword(credentials);
    // onAuthStateChange will handle user and session state.
    return { error };
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    // onAuthStateChange will handle user and session state being set to null.
    return { error };
  };

  const signUp = async (credentials: SignUpWithPasswordCredentials) => {
    const { data, error } = await supabase.auth.signUp(credentials);
    // onAuthStateChange will handle new user session if successful and email is confirmed (if required).
    return { data: { user: data.user, session: data.session }, error };
  };


  return (
    <AuthContext.Provider value={{ user, session, loading, login, logout, signUp }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};
