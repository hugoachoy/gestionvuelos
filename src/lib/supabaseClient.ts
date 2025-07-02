
import { createClient } from '@supabase/supabase-js';

// --- Client for Public Access (Browser, Client-side Components) ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl.trim() === '') {
  throw new Error(
    "Supabase URL is missing or empty. Ensure NEXT_PUBLIC_SUPABASE_URL is set correctly in your .env.local file and that the Next.js server has been restarted."
  );
}

if (!supabaseAnonKey || supabaseAnonKey.trim() === '') {
  throw new Error(
    "Supabase anon key is missing or empty. Ensure NEXT_PUBLIC_SUPABASE_ANON_KEY is set correctly in your .env.local file and that the Next.js server has been restarted."
  );
}

try {
  new URL(supabaseUrl);
} catch (e) {
  throw new Error(
    `The Supabase URL provided ("${supabaseUrl}") is not a valid URL. Please check the value of NEXT_PUBLIC_SUPABASE_URL in your .env.local file.`
  );
}

if (!supabaseAnonKey.startsWith('eyJ')) {
  console.warn(
    `Warning: The Supabase anon key provided does not look like a standard JWT (expected to start with "eyJ..."). Please double-check NEXT_PUBLIC_SUPABASE_ANON_KEY.`
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


// --- Admin Client for Server-Side Operations (Bypasses RLS) ---
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// This check ensures the admin client is only created in a server environment
// where the service role key is expected to be available.
if (!supabaseServiceRoleKey && process.env.NODE_ENV !== 'development') { // Allow development without it for client-side work
    console.warn("SUPABASE_SERVICE_ROLE_KEY is not set. Admin operations will fail.");
}

export const supabaseAdmin = supabaseServiceRoleKey 
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : supabase; // Fallback to regular client if key is not present

if (!supabaseServiceRoleKey) {
  console.warn("Admin client falling back to anon key. Server-side admin operations will likely fail due to insufficient permissions.");
}
