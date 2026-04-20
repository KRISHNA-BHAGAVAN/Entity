const STORAGE_KEY = "entity_supabase_project_config";

const normalizeUrl = (url) => {
  try {
    const parsed = new URL((url || "").trim());
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) {
      return null;
    }
    return `https://${parsed.hostname}`;
  } catch {
    return null;
  }
};

const isLikelyAnonKey = (value) => {
  const token = (value || "").trim();
  return token.length > 40 && token.startsWith("eyJ");
};

export const validateSupabaseProjectConfig = ({ url, anonKey }) => {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    return { valid: false, error: "Use a valid https://<project-ref>.supabase.co URL." };
  }
  if (!isLikelyAnonKey(anonKey)) {
    return { valid: false, error: "Enter a valid Supabase anon public key." };
  }
  return { valid: true, normalized: { url: normalizedUrl, anonKey: anonKey.trim() } };
};

export const getStoredSupabaseProjectConfig = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const result = validateSupabaseProjectConfig(parsed);
    return result.valid ? result.normalized : null;
  } catch {
    return null;
  }
};

export const setStoredSupabaseProjectConfig = ({ url, anonKey }) => {
  const result = validateSupabaseProjectConfig({ url, anonKey });
  if (!result.valid) {
    throw new Error(result.error);
  }
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...result.normalized,
      configuredAt: new Date().toISOString(),
    })
  );
};

export const clearStoredSupabaseProjectConfig = () => {
  localStorage.removeItem(STORAGE_KEY);
};
