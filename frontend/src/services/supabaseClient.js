import { createClient } from '@supabase/supabase-js';
import { getStoredSupabaseProjectConfig } from './supabaseProjectConfig';

const getEnvSupabaseConfig = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
};

export const getRuntimeSupabaseConfig = () => {
  const stored = getStoredSupabaseProjectConfig();
  if (stored) return stored;
  return getEnvSupabaseConfig();
};

export const isConfigured = () => !!getRuntimeSupabaseConfig();

let clientInstance = null;

export const resetSupabaseClient = () => {
  clientInstance = null;
};

export const getSupabaseClient = () => {
  if (clientInstance) {
    return clientInstance;
  }

  const config = getRuntimeSupabaseConfig();
  if (!config) {
    return null;
  }

  clientInstance = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return clientInstance;
};

export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase is not configured yet. Complete setup first.');
      }
      return client[prop];
    },
  }
);