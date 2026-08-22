import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { FIELD_WRAPPER, FIELD_INPUT, FIELD_LABEL } from "./LoginPage";
import AuthBrandHeader from "../components/AuthBrandHeader";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/auth/forgot-password", { email }, 60000);
      setSent(true);
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
          {sent ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={18} className="text-green-500" />
                <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Check your email</h1>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                If an account exists for <span className="font-medium">{email}</span>, we've sent a link to reset
                your password. The link expires in 1 hour.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Reset your password</h1>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">
                Enter your account email and we'll send you a link to reset your password.
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
                      autoFocus
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
                  {submitting ? "Sending…" : "Send reset link"} <ArrowRight size={14} />
                </button>
              </form>
            </>
          )}

          <Link
            to="/login"
            className="block w-full text-center text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mt-4 transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
