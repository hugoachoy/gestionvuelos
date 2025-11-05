
"use client";

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import type { Session, User as SupabaseAuthUser, AuthError, SignInWithPasswordCredentials, SignUpWithPasswordCredentials } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import type { AuthUser } from '@/types'; 

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  login: (credentials: SignInWithPasswordCredentials) => Promise<{ error: AuthError | null }>;
  logout: () => Promise<{ error: AuthError | null }>;
  signUp: (credentials: SignUpWithPasswordCredentials) => Promise<{ data: { user: SupabaseAuthUser | null, session: Session | null }, error: AuthError | null }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true); 

  const fetchUserProfile = async (currentSession: Session | null) => {
    if (currentSession) {
      try {
        const { data: pilotProfile, error: pilotError } = await supabase
          .from('pilots')
          .select('is_admin, first_name, last_name')
          .eq('auth_user_id', currentSession.user.id)
          .single();

        if (pilotError && pilotError.code !== 'PGRST116') {
          console.error("AuthContext: Error fetching pilot profile:", pilotError);
        }
        
        setUser({
          id: currentSession.user.id,
          email: currentSession.user.email,
          is_admin: pilotProfile?.is_admin ?? false,
          first_name: pilotProfile?.first_name ?? undefined,
          last_name: pilotProfile?.last_name ?? undefined,
        });
        setSession(currentSession);

      } catch (e) {
        console.error("AuthContext: Exception fetching pilot profile:", e);
        setUser({
          id: currentSession.user.id,
          email: currentSession.user.email,
          is_admin: false,
          first_name: undefined,
          last_name: undefined,
        });
        setSession(currentSession);
      }
    } else {
      setUser(null);
      setSession(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    const getInitialSession = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      await fetchUserProfile(initialSession);
      setLoading(false);
    };

    getInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      await fetchUserProfile(currentSession);
      setLoading(false);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []); 

  const refreshUser = async () => {
    setLoading(true);
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    await fetchUserProfile(currentSession);
  }

  const login = async (credentials: SignInWithPasswordCredentials) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) setLoading(false);
    // onAuthStateChange will handle user state update
    return { error };
  };

  const logout = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) setLoading(false);
    // onAuthStateChange will clear user state
    return { error };
  };

  const signUp = async (credentials: SignUpWithPasswordCredentials) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp(credentials);
    // onAuthStateChange will handle the session update. If there's an error, we stop loading.
    if (error) setLoading(false);
    return { data: { user: data.user, session: data.session }, error };
  };


  return (
    <AuthContext.Provider value={{ user, session, loading, login, logout, signUp, refreshUser }}>
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
