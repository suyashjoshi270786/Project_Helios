import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";

export type CascadeCounts = { subfolders?: number; suites?: number; testCases?: number };

function describeCounts(counts: CascadeCounts): string {
  const parts: string[] = [];
  if (counts.subfolders) parts.push(`${counts.subfolders} subfolder${counts.subfolders === 1 ? "" : "s"}`);
  if (counts.suites) parts.push(`${counts.suites} test suite${counts.suites === 1 ? "" : "s"}`);
  if (counts.testCases) parts.push(`${counts.testCases} test case${counts.testCases === 1 ? "" : "s"}`);
  if (parts.length === 0) return "everything inside it";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export default function CascadeDeleteModal({
  kind,
  name,
  counts,
  onCancel,
  onConfirm,
}: {
  kind: "folder" | "test suite";
  name: string;
  counts: CascadeCounts;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

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
            <AlertTriangle size={15} className="text-red-500" /> Delete {kind === "folder" ? "Folder" : "Test Suite"}
          </h2>
          <button onClick={onCancel} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-800 dark:text-slate-200">{name}</span> contains{" "}
            {describeCounts(counts)}. Deleting it removes all of that permanently — this cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-medium rounded-lg px-3.5 py-2"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
            >
              {deleting && <Loader2 size={13} className="animate-spin" />}
              Delete Everything
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
