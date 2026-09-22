import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, PlayCircle, X } from "lucide-react";
import { api, ApiError } from "../../../lib/api";

type TestCycleOption = { id: string; code: string; name: string; status: string };

// Reuses the existing POST /api/test-cycles/:id/tests endpoint (already
// idempotent — skips cases already in the cycle) rather than inventing a
// new one; this modal only adds the "which cycle" picker that didn't exist
// from the Test Cases side before.
export default function AddToCycleModal({
  projectId,
  testCaseIds,
  onClose,
  onDone,
}: {
  projectId: string;
  testCaseIds: string[];
  onClose: () => void;
  onDone: (cycleName: string) => void;
}) {
  const [cycles, setCycles] = useState<TestCycleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get<TestCycleOption[]>(`/api/test-cycles?projectId=${projectId}`)
      .then(setCycles)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load test cycles."))
      .finally(() => setLoading(false));
  }, [projectId]);

  async function handleConfirm() {
    const cycle = cycles.find((c) => c.id === selectedId);
    if (!cycle) return;
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/api/test-cycles/${cycle.id}/tests`, { testCaseIds });
      onDone(cycle.name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add those test cases to the cycle.");
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
            <PlayCircle size={15} /> Add {testCaseIds.length} Test Case{testCaseIds.length === 1 ? "" : "s"} to Cycle
          </h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 py-4 justify-center">
              <Loader2 size={13} className="animate-spin" /> Loading…
            </div>
          ) : cycles.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">No test cycles yet in this project.</p>
          ) : (
            cycles.map((cycle) => (
              <label
                key={cycle.id}
                className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                  selectedId === cycle.id
                    ? "border-indigo-500/50 bg-indigo-500/5"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/40"
                }`}
              >
                <input type="radio" name="cycle" checked={selectedId === cycle.id} onChange={() => setSelectedId(cycle.id)} className="accent-indigo-600" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                    {cycle.code} {cycle.name}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">{cycle.status}</div>
                </div>
              </label>
            ))
          )}
          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800">
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm font-medium px-3 py-2">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedId || submitting}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            Add
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
