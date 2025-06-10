
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
      setLoading(true); 
      
      if (currentSession) {
        try {
          const { data: pilotProfile, error: pilotError } = await supabase
            .from('pilots')
            .select('is_admin, first_name, last_name') // Obtener first_name y last_name
            .eq('auth_user_id', currentSession.user.id)
            .single();

          if (pilotError && pilotError.code !== 'PGRST116') { 
            console.error("AuthContext: Error fetching pilot profile on auth change:", pilotError);
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
          // En caso de error, establecer un usuario base sin nombre/apellido/admin
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
    // El listener onAuthStateChange se encargará de actualizar el estado y setLoading a false
    return { error };
  };

  const logout = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
     if (error) {
        setLoading(false); 
    }
    // El listener onAuthStateChange se encargará de actualizar el estado y setLoading a false
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
    // El listener onAuthStateChange se encargará de actualizar el estado y setLoading a false si no hay sesión
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
