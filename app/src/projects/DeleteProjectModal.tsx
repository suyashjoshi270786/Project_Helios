import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";
import type { Project } from "./ProjectContext";

export default function DeleteProjectModal({
  project,
  onCancel,
  onConfirm,
}: {
  project: Project;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const matches = confirmText.trim() === project.name;

  async function handleConfirm() {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
            <AlertTriangle size={15} className="text-red-500" /> Delete Project
          </h2>
          <button
            onClick={onCancel}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            This permanently deletes <span className="font-medium text-slate-800 dark:text-slate-200">{project.name}</span>{" "}
            and everything inside it — requirements, test plans, test cases, test cycles, and defects. This cannot be
            undone.
          </p>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
              Type <span className="font-medium text-slate-700 dark:text-slate-300">{project.name}</span> to confirm
            </label>
            <input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={project.name}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-red-500 transition-colors"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-medium rounded-lg px-3.5 py-2"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!matches || deleting}
              className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
            >
              {deleting && <Loader2 size={13} className="animate-spin" />}
              Delete Project
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
