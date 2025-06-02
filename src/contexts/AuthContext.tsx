
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
  const [loading, setLoading] = useState(true); // Inicia en true

  useEffect(() => {
    // onAuthStateChange maneja el evento INITIAL_SESSION, por lo que no necesitamos una llamada separada a getInitialSession.
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      let isAdminStatus = false; // Valor por defecto

      if (currentSession) {
        try {
          const { data: pilotProfile, error: pilotError } = await supabase
            .from('pilots')
            .select('is_admin')
            .eq('auth_user_id', currentSession.user.id)
            .single();

          if (pilotError && pilotError.code !== 'PGRST116') { // PGRST116 significa que no se encontraron filas, lo cual es un caso válido.
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
          // En caso de error al obtener el perfil, establecer is_admin a false pero mantener la sesión.
          setUser({
            id: currentSession.user.id,
            email: currentSession.user.email,
            is_admin: false, // Importante para que no se rompa si el perfil no existe o falla.
          });
          setSession(currentSession);
        }
      } else {
        setUser(null);
        setSession(null);
      }
      // Establecer loading a false DESPUÉS de intentar obtener el perfil del piloto y el estado de la sesión.
      setLoading(false);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []); // El array de dependencias vacío es correcto para que se ejecute una vez al montar.

  const login = async (credentials: SignInWithPasswordCredentials) => {
    setLoading(true); // Opcional: indicar carga durante el intento de login
    const { error } = await supabase.auth.signInWithPassword(credentials);
    // onAuthStateChange se encargará de actualizar user, session y loading después de este evento.
    if (error) {
        // Si hay un error, onAuthStateChange podría no establecer loading a false si no hay cambio de sesión.
        // Forzamos loading a false si sigue en true y no hay sesión.
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
    // onAuthStateChange se encargará de poner user/session a null y loading a false.
     if (error) {
        setLoading(false); // Asegurar que loading se maneje en caso de error de logout
    }
    return { error };
  };

  const signUp = async (credentials: SignUpWithPasswordCredentials) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp(credentials);
    // onAuthStateChange se encargará de la nueva sesión si el registro es exitoso (y el email se confirma si es necesario).
    // Si hay error, onAuthStateChange podría no actualizar el estado de carga.
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
