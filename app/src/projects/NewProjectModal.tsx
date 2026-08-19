import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { useProject } from "./ProjectContext";

export default function NewProjectModal({ onClose }: { onClose: () => void }) {
  const { createProject } = useProject();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    setSaving(true);
    setError("");
    const result = await createProject(name, description || undefined);
    setSaving(false);
    if (result.ok) {
      onClose();
    } else {
      setError(result.error ?? "Could not create project.");
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">New Project</h2>
          <button
            onClick={onClose}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Project Name *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="E-Commerce Web Application"
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-blue-600 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional description"
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-blue-600 transition-colors resize-y"
            />
          </div>
          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-medium rounded-lg px-3.5 py-2"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !name.trim()}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Create Project
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
