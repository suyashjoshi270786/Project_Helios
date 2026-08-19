import { useState } from "react";
import { Loader2, Sun } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useProject } from "./ProjectContext";

export default function FirstProjectGate() {
  const { logout } = useAuth();
  const { createProject } = useProject();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const result = await createProject(name, description || undefined);
    setSaving(false);
    if (!result.ok) setError(result.error ?? "Could not create project.");
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
            <Sun size={20} className="text-slate-950" />
          </div>
          <div className="text-left">
            <div className="text-[10px] tracking-widest text-slate-400 dark:text-slate-500 leading-none">
              PROJECT
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-white leading-tight">HELIOS</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Create your first project</h1>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">
            Requirements, Test Planning, and every other module live inside a project. Create one to get
            started.
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 block">Project Name *</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
                placeholder="E-Commerce Web Application"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-blue-600 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 block">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Optional description"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-blue-600 transition-colors resize-y"
              />
            </div>

            {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

            <button
              onClick={handleCreate}
              disabled={saving || !name.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-lg py-2.5 flex items-center justify-center gap-1.5"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Create Project
            </button>
          </div>

          <button
            type="button"
            onClick={logout}
            className="w-full text-center text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mt-4 transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
