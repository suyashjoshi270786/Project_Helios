import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle, Sun, Lock, User } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../auth/AuthContext";
import { FIELD_WRAPPER, FIELD_INPUT, FIELD_LABEL } from "../LoginPage";

type InviteInfo = { teamName: string; inviterName: string; email: string; role: string };

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, register } = useAuth();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const info = await api.get<InviteInfo>(`/api/teams/invites/${token}`);
        setInvite(info);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load this invite.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    setError("");
    try {
      const result = await api.post<{ teamName: string }>(`/api/teams/invites/${token}/accept`, {});
      setAccepted(true);
      setTimeout(() => navigate("/team"), 1500);
      void result;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not accept this invite.");
    } finally {
      setAccepting(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !invite) return;
    setError("");
    if (!name.trim() || !password.trim()) {
      setError("Enter your name and a password.");
      return;
    }
    setRegistering(true);
    const result = await register(name.trim(), invite.email, password, token);
    setRegistering(false);
    if (!result.ok) {
      setError(result.error || "Could not create your account.");
      return;
    }
    setAccepted(true);
    setTimeout(() => navigate("/team"), 1500);
  }

  const emailMatches = isAuthenticated && user?.email === invite?.email;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-md shadow-orange-500/25">
            <Sun size={18} className="text-slate-950" />
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">HELIOS</div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-6 justify-center">
            <Loader2 size={14} className="animate-spin" /> Loading invite…
          </div>
        ) : error ? (
          <div className="flex items-center gap-1.5 text-sm text-red-500 dark:text-red-400">
            <AlertCircle size={14} /> {error}
          </div>
        ) : accepted ? (
          <div className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={14} /> You're in! Taking you to the team…
          </div>
        ) : invite ? (
          <>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              <span className="font-medium">{invite.inviterName}</span> invited you to join{" "}
              <span className="font-medium">{invite.teamName}</span> as {invite.role === "Admin" ? "an" : "a"} {invite.role}.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Invited email: {invite.email}</p>

            {!isAuthenticated ? (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Already have an account with {invite.email}?{" "}
                  <Link to="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                    Sign in
                  </Link>{" "}
                  — otherwise, set a name and password to create one and join.
                </p>
                <form onSubmit={handleRegister} className="space-y-3">
                  <div>
                    <label className={FIELD_LABEL}>Name</label>
                    <div className={FIELD_WRAPPER}>
                      <User size={14} className="text-slate-400 dark:text-slate-600 shrink-0" />
                      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className={FIELD_INPUT} autoComplete="name" />
                    </div>
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Password</label>
                    <div className={FIELD_WRAPPER}>
                      <Lock size={14} className="text-slate-400 dark:text-slate-600 shrink-0" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={FIELD_INPUT}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={registering}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-lg px-3.5 py-2"
                  >
                    {registering ? "Creating account…" : `Create account & join ${invite.teamName}`}
                  </button>
                </form>
              </div>
            ) : !emailMatches ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                This invite was sent to {invite.email}, but you're signed in as {user?.email}. Sign in with the invited email to
                accept.
              </p>
            ) : (
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-lg px-3.5 py-2"
              >
                {accepting ? "Joining…" : `Join ${invite.teamName}`}
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
