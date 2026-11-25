import { createClient } from '@supabase/supabase-js'

// Hanya URL + anon/publishable key yang boleh ada di frontend.
// Keduanya aman dibagikan karena data dilindungi Row Level Security di database.
// Service role key TIDAK BOLEH dipakai di sini.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && key && !url.includes('xxxxxxxx'))

export const supabase = supabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
