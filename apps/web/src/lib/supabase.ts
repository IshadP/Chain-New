import { createClient } from '@supabase/supabase-js';

// Ensure you have these variables in your .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Use the public ANONYMOUS key for client-side initialization
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// This is a more robust singleton pattern for creating the Supabase client.
// It ensures that we only create one instance of the client for the entire application lifecycle.
const globalForSupabase = globalThis as unknown as {
  supabase: ReturnType<typeof createClient> | undefined;
};

export const supabase =
  globalForSupabase.supabase ??
  createClient(supabaseUrl, supabaseAnonKey); // <-- Pass the anonymous key here

if (process.env.NODE_ENV !== 'production') {
    globalForSupabase.supabase = supabase;
}