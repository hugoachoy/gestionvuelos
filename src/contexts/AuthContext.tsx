
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true); 

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setLoading(true); // Set loading to true at the start of auth state change
      let isAdminStatus = false; 

      if (currentSession) {
        try {
          const { data: pilotProfile, error: pilotError } = await supabase
            .from('pilots')
            .select('is_admin')
            .eq('auth_user_id', currentSession.user.id)
            .single();

          if (pilotError && pilotError.code !== 'PGRST116') { 
            console.error("AuthContext: Error fetching pilot profile on auth change:", pilotError);
          }
          isAdminStatus = pilotProfile?.is_admin ?? false;
          
          setUser({
            id: currentSession.user.id,
            email: currentSession.user.email,
            is_admin: isAdminStatus,
          });
          setSession(currentSession);

        } catch (e) {
          console.error("AuthContext: Exception fetching pilot profile:", e);
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
      setLoading(false); // Set loading to false AFTER all async operations are done
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []); 

  const login = async (credentials: SignInWithPasswordCredentials) => {
    setLoading(true); 
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) {
        const { data: { session: currentAuthSession } } = await supabase.auth.getSession();
        if (!currentAuthSession) {
            setLoading(false);
        }
    }
    return { error };
  };

  const logout = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
     if (error) {
        setLoading(false); 
    }
    return { error };
  };

  const signUp = async (credentials: SignUpWithPasswordCredentials) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp(credentials);
     if (error) {
        const { data: { session: currentAuthSession } } = await supabase.auth.getSession();
        if (!currentAuthSession) {
            setLoading(false);
        }
    }
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

