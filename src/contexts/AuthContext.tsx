
"use client";

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import type { Session, User, AuthError, SignInWithPasswordCredentials, SignUpWithPasswordCredentials } from '@supabase/supabase-js';
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
  const [loading, setLoading] = useState(true); // Manages initial loading state

  useEffect(() => {
    const getSession = async () => {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Error al obtener la sesión inicial:", error);
        setLoading(false); // Stop loading if initial session fetch fails
        return;
      }
      
      // Set initial session and user but rely on onAuthStateChange for INITIAL_SESSION to set loading to false
      // This prevents a flash of loading if onAuthStateChange fires immediately.
      setSession(currentSession);
      setUser(currentSession?.user ? { id: currentSession.user.id, email: currentSession.user.email } : null);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ? { id: currentSession.user.id, email: currentSession.user.email } : null);
      
      // Set loading to false once the initial session is established or confirmed to be null.
      if (event === 'INITIAL_SESSION') {
        setLoading(false);
      } else if (event === 'SIGNED_IN' && loading) { // If signed in during initial load phase
        setLoading(false);
      } else if (event === 'SIGNED_OUT' && loading) { // If signed out during initial load phase
         setLoading(false);
      }
      // If no session and still loading, and it's not an event that implies an ongoing process (like USER_UPDATED)
      // This is a fallback in case INITIAL_SESSION doesn't fire as expected with null session.
      else if (!currentSession && loading && event !== 'USER_UPDATED' && event !== 'PASSWORD_RECOVERY' && event !== 'TOKEN_REFRESHED' && event !== 'MFA_CHALLENGE_VERIFIED') {
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
        // The onAuthStateChange listener will handle session updates and loading state.
        // No need for fallback setLoading(false) here as it might conflict.
    }
    return { error };
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Error de cierre de sesión:", error.message);
        // The onAuthStateChange listener will handle session updates and loading state.
    }
    // setUser(null) and setSession(null) will be triggered by onAuthStateChange
    return { error };
  };

  const signUp = async (credentials: SignUpWithPasswordCredentials) => {
    const { data, error } = await supabase.auth.signUp(credentials);
    if (error) {
        console.error("Error de registro:", error.message);
        // The onAuthStateChange listener will handle session updates and loading state.
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
