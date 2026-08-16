import { useState } from "react";
import { Camera, Loader2, Moon, Save, Trash2 } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { resizeImageToDataUrl } from "../lib/image";
import { useTheme } from "../theme/ThemeContext";

const DESIGNATIONS = [
  "Software Engineer",
  "Quality Engineer",
  "Test Architect",
  "Business Analyst",
  "Test Manager",
];

export default function SettingsPage() {
  const { user, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isPreset = user?.role ? DESIGNATIONS.includes(user.role) : true;

  const [name, setName] = useState(user?.name ?? "");
  const [designation, setDesignation] = useState(isPreset ? user?.role ?? DESIGNATIONS[2] : "Other");
  const [customDesignation, setCustomDesignation] = useState(isPreset ? "" : user?.role ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(user?.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setAvatarUrl(await resizeImageToDataUrl(file));
    } catch {
      setError("Could not process that image.");
    }
  }

  async function handleSave() {
    setError("");
    setSaved(false);
    if (designation === "Other" && !customDesignation.trim()) {
      setError("Enter your designation.");
      return;
    }
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }

    setSaving(true);
    const role = designation === "Other" ? customDesignation.trim() : designation;
    const result = await updateProfile({ name: name.trim(), role, avatarUrl });
    setSaving(false);
    if (!result.ok) {
      setError(result.error || "Could not save changes.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          Update your name, designation, profile photo, and app appearance.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Moon size={15} />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">Night Mode</div>
              <div className="text-xs text-slate-400 dark:text-slate-500">
                {theme === "dark" ? "Dark background (current)" : "Light background (current)"}
              </div>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            role="switch"
            aria-checked={theme === "dark"}
            aria-label="Toggle night mode"
            className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
              theme === "dark" ? "bg-blue-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                theme === "dark" ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-4">
          <label className="relative w-16 h-16 rounded-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 flex items-center justify-center shrink-0 cursor-pointer overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Camera size={20} className="text-slate-400 dark:text-slate-600" />
            )}
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 dark:text-slate-400">Profile photo</span>
            {avatarUrl && (
              <button
                onClick={() => setAvatarUrl(null)}
                className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-red-400 transition-colors w-fit"
              >
                <Trash2 size={12} /> Remove photo
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 block">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600 transition-colors"
          />
        </div>

        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 block">Email</label>
          <input
            type="email"
            value={user?.email ?? ""}
            disabled
            className="w-full bg-slate-100/70 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-400 dark:text-slate-500 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 block">Designation</label>
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

        {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
        {saved && <p className="text-xs text-emerald-500 dark:text-emerald-400">Saved.</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Save changes
        </button>
      </div>
    </div>
  );
}
