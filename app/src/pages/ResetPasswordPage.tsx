import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, ArrowRight, AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { FIELD_WRAPPER, FIELD_INPUT, FIELD_LABEL } from "./LoginPage";
import AuthBrandHeader from "../components/AuthBrandHeader";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is missing its token. Request a new one.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/api/auth/reset-password", { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <AuthBrandHeader />

        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          {done ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={18} className="text-green-500" />
                <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Password reset</h1>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                Your password has been updated. You can now sign in with your new password.
              </p>
              <button
                onClick={() => navigate("/login", { replace: true })}
                className="w-full bg-blue-600 hover:bg-blue-500 transition-colors text-white text-sm font-medium rounded-lg py-2.5 flex items-center justify-center gap-1.5"
              >
                Sign in <ArrowRight size={14} />
              </button>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Set a new password</h1>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">Choose a new password for your account.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={FIELD_LABEL}>New password</label>
                  <div className={FIELD_WRAPPER}>
                    <Lock size={14} className="text-slate-400 dark:text-slate-600 shrink-0" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={FIELD_INPUT}
                      autoComplete="new-password"
                      autoFocus
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

                <div>
                  <label className={FIELD_LABEL}>Confirm new password</label>
                  <div className={FIELD_WRAPPER}>
                    <Lock size={14} className="text-slate-400 dark:text-slate-600 shrink-0" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={FIELD_INPUT}
                      autoComplete="new-password"
                    />
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
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-lg py-2.5 flex items-center justify-center gap-1.5"
                >
                  {submitting ? "Saving…" : "Reset password"} <ArrowRight size={14} />
                </button>
              </form>
            </>
          )}

          {!done && (
            <Link
              to="/login"
              className="block w-full text-center text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mt-4 transition-colors"
            >
              Back to sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
