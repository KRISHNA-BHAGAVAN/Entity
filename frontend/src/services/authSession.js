import { supabase } from "./supabaseClient";

let cachedSession = null;
let sessionHydrated = false;
let sessionHydration = null;
let authListenerRegistered = false;

const syncCachedSession = (session) => {
  cachedSession = session || null;
  sessionHydrated = true;
};

const ensureAuthListener = () => {
  if (authListenerRegistered) return;
  authListenerRegistered = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    syncCachedSession(session);
  });
};

export const getSessionSnapshot = async () => {
  ensureAuthListener();

  if (sessionHydrated) {
    return cachedSession;
  }

  if (!sessionHydration) {
    sessionHydration = supabase.auth
      .getSession()
      .then(({ data }) => {
        syncCachedSession(data?.session || null);
        return cachedSession;
      })
      .finally(() => {
        sessionHydration = null;
      });
  }

  return sessionHydration;
};

export const getAccessToken = async () => {
  const session = await getSessionSnapshot();
  return session?.access_token || null;
};

export const getCurrentUserId = async () => {
  const session = await getSessionSnapshot();
  return session?.user?.id || null;
};
