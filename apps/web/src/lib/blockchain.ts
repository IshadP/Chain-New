// FILE: apps/web/src/lib/supabase.ts

import { createClient } from '@supabase/supabase-js';

// Ensure you have these variables in your .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;

// This is a more robust singleton pattern for creating the Supabase client.
// It ensures that we only create one instance of the client for the entire application lifecycle.
const globalForSupabase = globalThis as unknown as {
  supabase: ReturnType<typeof createClient> | undefined;
};

export const supabase =
  globalForSupabase.supabase ??
  createClient(supabaseUrl, supabaseSecretKey);

if (process.env.NODE_ENV !== 'production') globalForSupabase.supabase = supabase;