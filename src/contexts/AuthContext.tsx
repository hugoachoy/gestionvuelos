
"use client";

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import type { Session, User, AuthError, SignInWithPasswordCredentials, SignUpWithPasswordCredentials } from '@supabase/supabase-js'; // Subscription import removed as it's handled differently now
import { supabase } from '@/lib/supabaseClient';
import type { AuthUser } from '@/types';

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  login: (credentials: SignInWithPasswordCredentials) => Promise<{ error: AuthError | null }>;
  logout: () => Promise<{ error: AuthError | null }>;
  signUp: (credentials: SignUpWithPasswordCredentials) => Promise<{ data: { user: User | null, session: Session | null }, error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Error al obtener la sesión inicial:", error);
        setLoading(false); // Stop loading if initial session fetch fails
        return;
      }
      
      setSession(currentSession);
      setUser(currentSession?.user ? { id: currentSession.user.id, email: currentSession.user.email } : null);
      // setLoading(false) will be handled by onAuthStateChange's INITIAL_SESSION
      // or if there's no session after the initial check by the listener.
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ? { id: currentSession.user.id, email: currentSession.user.email } : null);
      
      // This handles setting loading to false after the initial state is determined.
      if (event === 'INITIAL_SESSION' && loading) {
        setLoading(false);
      } else if (event === 'SIGNED_IN' && loading) {
        setLoading(false);
      } else if (event === 'SIGNED_OUT' && loading) {
        setLoading(false);
      } else if (!currentSession && loading && event !== 'USER_UPDATED' && event !== 'PASSWORD_RECOVERY' && event !== 'TOKEN_REFRESHED' ) {
        // If no session and still loading for other events, ensure loading stops.
        // Avoid stopping loading for events that don't necessarily mean initial load is done.
        setLoading(false);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs once on mount

  const login = async (credentials: SignInWithPasswordCredentials) => {
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) {
        console.error("Error de inicio de sesión:", error.message);
        // Fallback: if still loading after an error and no session was established by onAuthStateChange
        if (loading) {
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) {
                setLoading(false);
            }
        }
    }
    // setUser, setSession, and primary setLoading(false) are handled by onAuthStateChange
    return { error };
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Error de cierre de sesión:", error.message);
        if (loading) {
            // If logout errors, we should ensure loading is false, as the action is complete.
            setLoading(false);
        }
    }
    // setUser, setSession, and primary setLoading(false) are handled by onAuthStateChange
    return { error };
  };

  const signUp = async (credentials: SignUpWithPasswordCredentials) => {
    const { data, error } = await supabase.auth.signUp(credentials);
    if (error) {
        console.error("Error de registro:", error.message);
        if (loading) {
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) {
                setLoading(false);
            }
        }
    }
    // setUser, setSession, and primary setLoading(false) are handled by onAuthStateChange
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
