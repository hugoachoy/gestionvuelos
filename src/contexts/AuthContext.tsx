
"use client";

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import type { Session, User, AuthError, SignInWithPasswordCredentials, SignUpWithPasswordCredentials, Subscription } from '@supabase/supabase-js'; // Import Subscription
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
        console.error("Error al obtener la sesión:", error);
        setLoading(false);
        return;
      }
      
      setSession(currentSession);
      setUser(currentSession?.user ? { id: currentSession.user.id, email: currentSession.user.email } : null);
      setLoading(false); // Detener la carga inicial aquí, incluso si no hay sesión
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ? { id: currentSession.user.id, email: currentSession.user.email } : null);
      // Solo detener la carga inicial si este evento es el que procesa la sesión inicial
      // o si el evento de getSession() ya lo hizo.
      // Esto evita que setLoading(false) se llame múltiples veces innecesariamente.
      if (event === 'INITIAL_SESSION' && loading) { // Solo si loading es true
        setLoading(false);
      } else if (!currentSession && loading) { // Si no hay sesión y aún estamos cargando inicialmente
        setLoading(false);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // El array de dependencias vacío asegura que esto se ejecute solo una vez al montar/desmontar

  const login = async (credentials: SignInWithPasswordCredentials) => {
    // No establecer setLoading(true) aquí, onAuthStateChange manejará las actualizaciones de estado
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) {
        console.error("Error de inicio de sesión:", error.message);
        // Si hay un error, y no hay cambio de estado de auth, la carga podría no detenerse
        // Si no hay usuario/sesión después de un error, es seguro detener la carga si no se hizo.
        if (!supabase.auth.getSession()) setLoading(false); 
    }
    // setUser, setSession, y setLoading(false) serán manejados por onAuthStateChange
    return { error };
  };

  const logout = async () => {
    // No establecer setLoading(true) aquí
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Error de cierre de sesión:", error.message);
        if (supabase.auth.getSession()) setLoading(false);
    }
    // setUser, setSession, y setLoading(false) serán manejados por onAuthStateChange
    return { error };
  };

  const signUp = async (credentials: SignUpWithPasswordCredentials) => {
    // No establecer setLoading(true) aquí
    const { data, error } = await supabase.auth.signUp(credentials);
    if (error) {
        console.error("Error de registro:", error.message);
        if (!supabase.auth.getSession()) setLoading(false);
    }
    // setUser, setSession, y setLoading(false) serán manejados por onAuthStateChange
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
