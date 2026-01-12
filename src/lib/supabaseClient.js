import { createClient } from '@supabase/supabase-js';

let client = null;

export default function getSupabaseClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  client = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'rajskitchen-supabase-client' } },
  });

  return client;
}
