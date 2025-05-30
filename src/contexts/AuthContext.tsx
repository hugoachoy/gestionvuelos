
"use client";

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import type { Session, User, AuthError, SignInWithPasswordCredentials, SignUpWithPasswordCredentials, Subscription } from '@supabase/supabase-js';
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
        console.error("Error getting session:", error);
        setLoading(false);
        return;
      }
      
      setSession(currentSession);
      setUser(currentSession?.user ? { id: currentSession.user.id, email: currentSession.user.email } : null);
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ? { id: currentSession.user.id, email: currentSession.user.email } : null);
      // Only stop initial loading spinner after initial session is processed
      if (event === 'INITIAL_SESSION') {
        setLoading(false);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []); // Removed loading from dependency array as INITIAL_SESSION handles it

  const login = async (credentials: SignInWithPasswordCredentials) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) console.error("Login error:", error.message);
    // setLoading(false) will be handled by onAuthStateChange or if error occurs directly
    if (error) setLoading(false);
    return { error };
  };

  const logout = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Logout error:", error.message);
    // setUser and setSession will be updated by onAuthStateChange
    // setLoading(false) will be handled by onAuthStateChange or if error occurs directly
    if (error) setLoading(false);
    return { error };
  };

  const signUp = async (credentials: SignUpWithPasswordCredentials) => {
    setLoading(true);
    // Note: This only creates the Supabase auth user.
    // You'll need additional logic to create a corresponding profile in your 'pilots' table.
    const { data, error } = await supabase.auth.signUp(credentials);
    if (error) console.error("Sign up error:", error.message);
    // setUser and setSession will be updated by onAuthStateChange if sign up is successful and auto-confirms (or after email confirmation)
    // setLoading(false) will be handled by onAuthStateChange or if error occurs directly
    if (error) setLoading(false);
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
