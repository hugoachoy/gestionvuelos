import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Supabase URL not found. Did you forget to set NEXT_PUBLIC_SUPABASE_URL in your .env.local file?");
}

if (!supabaseAnonKey) {
  throw new Error("Supabase anon key not found. Did you forget to set NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file?");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
