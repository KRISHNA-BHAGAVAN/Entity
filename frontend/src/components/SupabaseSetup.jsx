import { useState } from "react";
import { configureSupabase } from "../services/supabaseClient";
import { Database, Save, AlertCircle } from "lucide-react";

export const SupabaseSetup = ({ onConfigured }) => {
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState("");

  const handleSave = (e) => {
    e.preventDefault();
    setError("");

    if (!url || !key) {
      setError("Both URL and API Key are required");
      return;
    }

    if (!url.startsWith("http")) {
      setError("URL must start with http:// or https://");
      return;
    }

    configureSupabase(url, key);
    onConfigured();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full border border-slate-100">
        <div className="text-center mb-8">
          <div className="bg-emerald-600 text-white p-3 rounded-xl inline-block mb-4 shadow-lg shadow-emerald-100">
            <Database size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            Connect Database
          </h1>
          <p className="text-slate-500 mt-2">
            Enter your Supabase project credentials
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-lg text-sm flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm mb-6 border border-blue-100">
          <p className="font-semibold mb-1">Required Database Tables:</p>
          <ul className="list-disc list-inside space-y-0.5 opacity-90">
            <li>
              <code className="text-xs bg-blue-100 px-1 py-0.5 rounded">
                events
              </code>
            </li>
            <li>
              <code className="text-xs bg-blue-100 px-1 py-0.5 rounded">
                templates
              </code>
            </li>
          </ul>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Project URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all font-mono text-sm"
              placeholder="https://xyz.supabase.co"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Anon / Public Key
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autocomplete="off"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all font-mono text-sm"
              placeholder="eyJh..."
            />
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Save size={20} />
            Connect & Continue
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Credentials are stored securely in your browser&apos;s Local Storage.
        </p>
      </div>
    </div>
  );
};
