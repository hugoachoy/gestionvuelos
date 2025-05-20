
import { createClient } from '@supabase/supabase-js';

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
  // Validate if the supabaseUrl is a valid URL format
  new URL(supabaseUrl);
} catch (e) {
  throw new Error(
    `The Supabase URL provided ("${supabaseUrl}") is not a valid URL. Please check the value of NEXT_PUBLIC_SUPABASE_URL in your .env.local file.`
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
