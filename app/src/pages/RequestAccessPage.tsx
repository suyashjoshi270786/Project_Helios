import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Mail, User, FileText } from "lucide-react";
import { api, ApiError } from "../lib/api";
import AuthBrandHeader from "../components/AuthBrandHeader";
import { FIELD_WRAPPER, FIELD_INPUT, FIELD_LABEL } from "./LoginPage";

export default function RequestAccessPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim()) {
      setError("Enter your name and email.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/access-requests", { name: name.trim(), email: email.trim(), reason: reason.trim() || undefined });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send your request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <AuthBrandHeader />

        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          {submitted ? (
            <div className="text-center space-y-2 py-4">
              <CheckCircle2 size={28} className="mx-auto text-emerald-500" />
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Request sent</h1>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                An owner or admin will review your request. We'll email you once your account is ready.
              </p>
              <Link to="/login" className="inline-block text-xs text-indigo-600 dark:text-indigo-400 hover:underline pt-2">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Request access</h1>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">
                HeliosQE accounts are provisioned by an owner or admin — tell us who you are and we'll get you set up.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={FIELD_LABEL}>Name</label>
                  <div className={FIELD_WRAPPER}>
                    <User size={14} className="text-slate-400 dark:text-slate-600 shrink-0" />
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className={FIELD_INPUT} autoComplete="name" />
                  </div>
                </div>
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
                  <label className={FIELD_LABEL}>Why do you need access? (optional)</label>
                  <div className={FIELD_WRAPPER + " items-start"}>
                    <FileText size={14} className="text-slate-400 dark:text-slate-600 shrink-0 mt-0.5" />
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. joining the QA team for Project X"
                      rows={2}
                      className={FIELD_INPUT + " resize-none"}
                    />
                  </div>
                </div>

                {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-lg py-2.5 flex items-center justify-center gap-1.5"
                >
                  {submitting ? "Sending…" : "Send request"} <ArrowRight size={14} />
                </button>
              </form>

              <Link
                to="/login"
                className="block w-full text-center text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mt-4 transition-colors"
              >
                Already have an account? Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
