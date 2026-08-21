import { useState } from "react";
import { useNavigate, useLocation, Navigate, Link } from "react-router-dom";
import { Mail, Lock, ArrowRight, AlertCircle, Camera, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { resizeImageToDataUrl } from "../lib/image";
import AuthBrandHeader from "../components/AuthBrandHeader";

const DESIGNATIONS = [
  "Software Engineer",
  "Quality Engineer",
  "Test Architect",
  "Business Analyst",
  "Test Manager",
];

export const FIELD_WRAPPER =
  "flex items-center gap-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 focus-within:border-blue-600 transition-colors";
export const FIELD_INPUT =
  "bg-transparent outline-none text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 w-full";
export const FIELD_LABEL = "text-xs text-slate-500 dark:text-slate-400 mb-1.5 block";

export default function LoginPage() {
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [designation, setDesignation] = useState(DESIGNATIONS[2]);
  const [customDesignation, setCustomDesignation] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (isAuthenticated) {
    const from = (location.state as any)?.from?.pathname || "/";
    return <Navigate to={from} replace />;
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setAvatarDataUrl(await resizeImageToDataUrl(file));
    } catch {
      setError("Could not process that image.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "register" && designation === "Other" && !customDesignation.trim()) {
      setError("Enter your designation.");
      return;
    }

    setSubmitting(true);
    const role = designation === "Other" ? customDesignation.trim() : designation;
    const result =
      mode === "signin" ? await login(email, password) : await register(name, email, password, role, avatarDataUrl);
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
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h1>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">
            AI-Powered Quality Engineering. Smarter Testing. Faster Releases.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <>
                <div className="flex items-center gap-3">
                  <label className="relative w-12 h-12 rounded-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 flex items-center justify-center shrink-0 cursor-pointer overflow-hidden">
                    {avatarDataUrl ? (
                      <img src={avatarDataUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Camera size={16} className="text-slate-400 dark:text-slate-600" />
                    )}
                    <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                  </label>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">Optional profile photo</p>
                </div>

                <div>
                  <label className={FIELD_LABEL}>Name</label>
                  <div className={FIELD_WRAPPER}>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className={FIELD_INPUT}
                      autoComplete="name"
                    />
                  </div>
                </div>

                <div>
                  <label className={FIELD_LABEL}>Designation</label>
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600 transition-colors"
                  >
                    {DESIGNATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                  {designation === "Other" && (
                    <input
                      type="text"
                      value={customDesignation}
                      onChange={(e) => setCustomDesignation(e.target.value)}
                      placeholder="Enter your designation"
                      className="w-full mt-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-blue-600 transition-colors"
                    />
                  )}
                </div>
              </>
            )}
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
                {mode === "signin" && (
                  <Link
                    to="/forgot-password"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline mb-1.5"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className={FIELD_WRAPPER}>
                <Lock size={14} className="text-slate-400 dark:text-slate-600 shrink-0" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={FIELD_INPUT}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
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
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-lg py-2.5 flex items-center justify-center gap-1.5"
            >
              {submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}{" "}
              <ArrowRight size={14} />
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setError("");
              setMode((m) => (m === "signin" ? "register" : "signin"));
            }}
            className="w-full text-center text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mt-4 transition-colors"
          >
            {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
