import { useState } from "react";
import { supabase } from "../services/supabaseClient";
import {
  Loader2,
  LogIn,
  UserPlus,
  AlertCircle,
  ShieldCheck,
  Info,
  Mail,
  KeyRound,
  CheckCircle2,
} from "lucide-react";

export const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Resend Logic
  const [resending, setResending] = useState(false);
  const [showResend, setShowResend] = useState(false);

  // Manual Verify Logic
  const [showVerify, setShowVerify] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [verifying, setVerifying] = useState(false);

  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setShowResend(false);
    setShowVerify(false);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        // Handle case where sign up is successful but email needs confirmation
        if (data.user && !data.session) {
          setSuccessMsg(
            "Account created! Please check your email to confirm your account before logging in."
          );
          setIsLogin(true); // Switch to login view so they can login after confirming
        }
      }
    } catch (err) {
      if (
        err.message &&
        (err.message.includes("Email not confirmed") ||
          err.message.includes("Invalid login credentials"))
      ) {
        setError(err.message);
        if (err.message.includes("Email not confirmed")) {
          setShowResend(true);
          setShowVerify(true);
        }
      } else {
        setError(err.message || "An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email,
      });
      if (error) throw error;
      setSuccessMsg(
        "Confirmation email resent. Please check your inbox and spam folder."
      );
      setError(null);
    } catch (err) {
      setError("Failed to resend: " + err.message);
    } finally {
      setResending(false);
    }
  };

  const handleManualVerification = async () => {
    if (!manualToken || !email) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: manualToken,
        type: "signup",
      });
      if (error) throw error;

      setSuccessMsg(
        "Email verified successfully! You are now being logged in..."
      );
      setError(null);
      setShowVerify(false);
      setShowResend(false);
      // Successful verification usually creates a session, which App.tsx will detect automatically
    } catch (err) {
      setError("Verification failed: " + err.message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-100">
        <div className="text-center mb-8">
          <div className="bg-blue-600 text-white p-3 rounded-xl inline-block mb-4 shadow-blue-200 shadow-lg">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Secure Access</h1>
          <p className="text-slate-500 mt-2">
            Secure cloud storage for your ERDs
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-lg text-sm flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>

            <div className="flex flex-wrap gap-3 mt-1 ml-6">
              {showResend && (
                <button
                  onClick={handleResendConfirmation}
                  disabled={resending}
                  className="text-xs font-bold underline hover:text-red-800 flex items-center gap-1"
                >
                  {resending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Mail size={12} />
                  )}
                  Resend Email
                </button>
              )}

              {/* Fallback verify option if email link fails */}
              <button
                onClick={() => {
                  setShowVerify(!showVerify);
                  setError(null);
                }}
                className="text-xs font-bold underline hover:text-red-800 flex items-center gap-1"
              >
                <KeyRound size={12} />
                Enter Token Manually
              </button>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-green-50 border border-green-100 text-green-700 rounded-lg text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
            <Info size={16} className="mt-0.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Manual Verification Form */}
        {showVerify && (
          <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl animate-in fade-in zoom-in-95">
            <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
              <KeyRound size={16} /> Manual Verification
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Paste the{" "}
              <span className="font-mono bg-slate-200 px-1 rounded">token</span>{" "}
              string from your confirmation email URL here.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="e.g. 28e29d7cc..."
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
              <button
                onClick={handleManualVerification}
                disabled={verifying || !manualToken}
                className="bg-slate-800 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-slate-900 disabled:opacity-50"
              >
                {verifying ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Email Address
            </label>
            <input
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Password
            </label>
            <input
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isLogin ? "current-password" : "new-password"}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : isLogin ? (
              <>
                <LogIn size={20} /> Sign In
              </>
            ) : (
              <>
                <UserPlus size={20} /> Create Account
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              setSuccessMsg(null);
              setShowResend(false);
              setShowVerify(false);
            }}
            className="text-sm text-slate-500 hover:text-blue-600 hover:cursor-pointer font-medium transition-colors"
          >
            {isLogin
              ? "Need an account? Sign Up"
              : "Already have an account? Sign In"}
          </button>
        </div>

        
      </div>
    </div>
  );
};
