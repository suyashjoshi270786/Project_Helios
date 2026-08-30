import { useState } from "react";
import { useNavigate, useLocation, Navigate, Link } from "react-router-dom";
import { Mail, Lock, ArrowRight, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import AuthBrandHeader from "../components/AuthBrandHeader";

export const FIELD_WRAPPER =
  "flex items-center gap-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 focus-within:border-indigo-600 transition-colors";
export const FIELD_INPUT =
  "bg-transparent outline-none text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 w-full";
export const FIELD_LABEL = "text-xs text-slate-500 dark:text-slate-400 mb-1.5 block";

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (isAuthenticated) {
    const from = (location.state as any)?.from?.pathname || "/";
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || "Something went wrong.");
      return;
    }
    const from = (location.state as any)?.from?.pathname || "/";
    navigate(from, { replace: true });
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <AuthBrandHeader />

        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Sign in</h1>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">
            AI-Powered Quality Engineering. Smarter Testing. Faster Releases.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={FIELD_LABEL}>Email</label>
              <div className={FIELD_WRAPPER}>
                <Mail size={14} className="text-slate-400 dark:text-slate-600 shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={FIELD_INPUT}
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className={FIELD_LABEL}>Password</label>
                <Link to="/forgot-password" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mb-1.5">
                  Forgot password?
                </Link>
              </div>
              <div className={FIELD_WRAPPER}>
                <Lock size={14} className="text-slate-400 dark:text-slate-600 shrink-0" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={FIELD_INPUT}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 shrink-0"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
                <AlertCircle size={13} /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-lg py-2.5 flex items-center justify-center gap-1.5"
            >
              {submitting ? "Please wait…" : "Sign in"} <ArrowRight size={14} />
            </button>
          </form>

          <Link
            to="/request-access"
            className="block w-full text-center text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mt-4 transition-colors"
          >
            New here? Request access
          </Link>
        </div>
      </div>
    </div>
  );
}
