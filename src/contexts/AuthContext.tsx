
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
    if (currentSession?.user) {
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
        // Set a default user object even on error to keep the app functional
        setUser({
          id: currentSession.user.id,
          email: currentSession.user.email,
          is_admin: false,
        });
        setSession(currentSession);
      }
    } else {
      setUser(null);
      setSession(null);
    }
  };

  useEffect(() => {
    setLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchUserProfile(session).finally(() => setLoading(false));
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      // The SIGNED_IN event can be triggered by the auth callback.
      // The SIGNED_OUT event is triggered on logout.
      // USER_UPDATED for password recovery.
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
    setLoading(false);
  }

  const login = async (credentials: SignInWithPasswordCredentials) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) setLoading(false);
    // onAuthStateChange will handle user state update and setting loading to false
    return { error };
  };

  const logout = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) setLoading(false);
    // onAuthStateChange will clear user state and set loading to false
    return { error };
  };

  const signUp = async (credentials: SignUpWithPasswordCredentials) => {
    setLoading(true);
    // The redirect is now handled by the server-side callback route
    const { data, error } = await supabase.auth.signUp(credentials);
    if (error) {
      setLoading(false);
    }
    // No need to handle session here, onAuthStateChange will take care of it
    // after user confirms their email.
    return { data: { user: data.user, session: data.session }, error };
  };


  const value = { user, session, loading, login, logout, signUp, refreshUser };

  return (
    <AuthContext.Provider value={value}>
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
