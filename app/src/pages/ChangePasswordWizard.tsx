import { useState } from "react";
import { ArrowRight, AlertCircle, Lock, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import AuthBrandHeader from "../components/AuthBrandHeader";
import { FIELD_WRAPPER, FIELD_INPUT, FIELD_LABEL } from "./LoginPage";

export default function ChangePasswordWizard() {
  const { changePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }
    setSubmitting(true);
    const result = await changePassword(currentPassword, newPassword);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || "Something went wrong.");
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <AuthBrandHeader />

        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-1.5 text-lg font-semibold text-slate-900 dark:text-white mb-1">
            <ShieldCheck size={18} className="text-indigo-500" /> Set a new password
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">
            Your account was created with a temporary password. Set your own before continuing.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={FIELD_LABEL}>Temporary password</label>
              <div className={FIELD_WRAPPER}>
                <Lock size={14} className="text-slate-400 dark:text-slate-600 shrink-0" />
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="The password you were given"
                  className={FIELD_INPUT}
                  autoComplete="current-password"
                  autoFocus
                />
              </div>
            </div>
            <div>
              <label className={FIELD_LABEL}>New password</label>
              <div className={FIELD_WRAPPER}>
                <Lock size={14} className="text-slate-400 dark:text-slate-600 shrink-0" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={FIELD_INPUT}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div>
              <label className={FIELD_LABEL}>Confirm new password</label>
              <div className={FIELD_WRAPPER}>
                <Lock size={14} className="text-slate-400 dark:text-slate-600 shrink-0" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Type it again"
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
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-lg py-2.5 flex items-center justify-center gap-1.5"
            >
              {submitting ? "Saving…" : "Set password & continue"} <ArrowRight size={14} />
            </button>
          </form>

          <button
            onClick={logout}
            className="block w-full text-center text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mt-4 transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
