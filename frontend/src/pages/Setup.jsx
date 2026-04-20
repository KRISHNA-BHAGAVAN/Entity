import { useMemo, useState } from "react";
import { ShieldCheck, Database, KeyRound, CheckCircle2, AlertTriangle, Loader2, Download, RefreshCcw } from "lucide-react";

import { API_BASE_URL } from "../config/api";
import { resetSupabaseClient } from "../services/supabaseClient";
import {
  setStoredSupabaseProjectConfig,
  validateSupabaseProjectConfig,
} from "../services/supabaseProjectConfig";

const initialState = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  dbPassword: "",
  dbHost: "",
  dbPort: "5432",
  dbName: "postgres",
};

const Setup = () => {
  const [form, setForm] = useState(initialState);
  const [step, setStep] = useState("form");
  const [error, setError] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const isAutomationEnabled = useMemo(() => !!form.dbPassword.trim(), [form.dbPassword]);

  const onChange = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const validateClientConfig = () => {
    const result = validateSupabaseProjectConfig({
      url: form.supabaseUrl,
      anonKey: form.supabaseAnonKey,
    });
    if (!result.valid) {
      setError(result.error);
      return null;
    }
    return result.normalized;
  };

  const handleValidate = async () => {
    const normalized = validateClientConfig();
    if (!normalized) return;

    setError("");
    setLoading(true);
    setStep("validating");

    try {
      const response = await fetch(`${API_BASE_URL}/api/setup/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supabase_url: normalized.url,
          supabase_anon_key: normalized.anonKey,
          db_password: form.dbPassword || null,
          db_host: form.dbHost || null,
          db_port: Number(form.dbPort || 5432),
          db_name: form.dbName || "postgres",
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload.valid === false) {
        throw new Error(payload?.errors?.[0] || payload?.detail || "Validation failed");
      }
      setStatus(payload);
      setStep("validated");
    } catch (exc) {
      setError(exc.message || "Could not validate project configuration.");
      setStep("form");
    } finally {
      setLoading(false);
    }
  };

  const handleProvision = async () => {
    const normalized = validateClientConfig();
    if (!normalized) return;

    if (!form.dbPassword.trim()) {
      setError("Add database password to run automated setup.");
      return;
    }

    setError("");
    setLoading(true);
    setStep("provisioning");

    try {
      const response = await fetch(`${API_BASE_URL}/api/setup/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supabase_url: normalized.url,
          supabase_anon_key: normalized.anonKey,
          db_password: form.dbPassword,
          db_host: form.dbHost || null,
          db_port: Number(form.dbPort || 5432),
          db_name: form.dbName || "postgres",
          target_version: 1,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || "Provisioning failed.");
      }

      setStoredSupabaseProjectConfig({ url: normalized.url, anonKey: normalized.anonKey });
      resetSupabaseClient();
      setStep("success");
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (exc) {
      setError(exc.message || "Provisioning failed.");
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const handleManualContinue = () => {
    const normalized = validateClientConfig();
    if (!normalized) return;

    try {
      setStoredSupabaseProjectConfig({ url: normalized.url, anonKey: normalized.anonKey });
      resetSupabaseClient();
      window.location.reload();
    } catch (exc) {
      setError(exc.message || "Unable to save project configuration.");
    }
  };

  const handleExportSchema = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/setup/export-schema?version=1`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || "Failed to export schema");

      const blob = new Blob([payload.content], { type: "text/sql;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = payload.filename || "entity_schema_v1.sql";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (exc) {
      setError(exc.message || "Unable to download fallback SQL.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-emerald-100 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-2xl shadow-slate-200 backdrop-blur-xl sm:p-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">One-Time Setup</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Connect Your Supabase Project</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              This app will use your own Supabase free-tier project. Your data stays in your account, and automated schema setup can finish in under a minute.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-900 p-3 text-white shadow-lg">
            <ShieldCheck className="h-8 w-8" />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <Database className="mb-2 h-5 w-5 text-emerald-700" />
            <p className="text-sm font-semibold text-slate-800">Your Database</p>
            <p className="mt-1 text-xs text-slate-600">Project URL + one-time DB password for automation.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <KeyRound className="mb-2 h-5 w-5 text-emerald-700" />
            <p className="text-sm font-semibold text-slate-800">Safe Runtime</p>
            <p className="mt-1 text-xs text-slate-600">Only URL and anon key are stored locally for sign-in.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <CheckCircle2 className="mb-2 h-5 w-5 text-emerald-700" />
            <p className="text-sm font-semibold text-slate-800">No Shared Data</p>
            <p className="mt-1 text-xs text-slate-600">Every faculty account is fully isolated.</p>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Supabase Project URL</span>
            <input
              type="url"
              value={form.supabaseUrl}
              onChange={onChange("supabaseUrl")}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none ring-0 transition focus:border-emerald-500"
              placeholder="https://your-project-ref.supabase.co"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Supabase Anon Public Key</span>
            <textarea
              value={form.supabaseAnonKey}
              onChange={onChange("supabaseAnonKey")}
              rows={3}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-xs text-slate-900 outline-none ring-0 transition focus:border-emerald-500"
              placeholder="eyJ..."
            />
          </label>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Automated Setup (Recommended)</p>
            <p className="mt-1 text-xs text-amber-800">
              Add your database password once so the app can create tables, policies, triggers, and indexes automatically.
              The password is never stored.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber-900">Database Password</span>
                <input
                  type="password"
                  value={form.dbPassword}
                  onChange={onChange("dbPassword")}
                  className="mt-2 w-full rounded-xl border border-amber-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
                  placeholder="From Supabase Settings > Database"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber-900">DB Host (Optional)</span>
                <input
                  type="text"
                  value={form.dbHost}
                  onChange={onChange("dbHost")}
                  className="mt-2 w-full rounded-xl border border-amber-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
                  placeholder="auto-derived"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber-900">DB Port</span>
                <input
                  type="number"
                  min="1"
                  max="65535"
                  value={form.dbPort}
                  onChange={onChange("dbPort")}
                  className="mt-2 w-full rounded-xl border border-amber-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
                />
              </label>
            </div>
          </div>
        </div>

        {status?.warnings?.length ? (
          <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
            {status.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleValidate}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-70"
          >
            {loading && step === "validating" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Validate Project
          </button>

          <button
            type="button"
            onClick={handleProvision}
            disabled={loading || !isAutomationEnabled}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading && step === "provisioning" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Run Automated Setup
          </button>

          <button
            type="button"
            onClick={handleExportSchema}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Download SQL Fallback
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-600">
            Already imported SQL manually? Save URL + anon key and continue.
          </p>
          <button
            type="button"
            onClick={handleManualContinue}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Continue to Sign-In
          </button>
        </div>

        {step === "success" ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            Setup completed. Loading your app...
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Setup;
