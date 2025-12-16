import { createClient } from '@supabase/supabase-js';

// Standard Vite environment variables - single source of truth
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if we have valid credentials
export const isConfigured = !!(supabaseUrl && supabaseKey);

// Initialize once - SDK handles localStorage for SESSION (JWT) automatically
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});