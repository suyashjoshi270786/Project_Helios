import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Loader2, X } from "lucide-react";
import { api, ApiError } from "../../../lib/api";
import { CARD_CLASS } from "../constants";
import { WORK_ITEM_TYPE_BADGE_CLASS } from "../../work-items/constants";
import type { WorkItem } from "../../work-items/types";
import type { TestExecution } from "../types";

export default function LinkExistingDefectModal({
  projectId,
  executionId,
  stepId,
  excludeIds,
  onClose,
  onLinked,
}: {
  projectId: string;
  executionId: string;
  stepId: string;
  excludeIds: string[];
  onClose: () => void;
  onLinked: (execution: TestExecution) => void;
}) {
  const [defects, setDefects] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [linkingId, setLinkingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const list = await api.get<WorkItem[]>(`/api/work-items?projectId=${projectId}&type=Defect`);
        setDefects(list);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load defects.");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const excluded = new Set(excludeIds);
  const visible = defects.filter(
    (d) => !excluded.has(d.id) && (d.key + " " + d.title).toLowerCase().includes(search.toLowerCase()),
  );

  async function handleLink(workItemId: string) {
    setLinkingId(workItemId);
    setError("");
    try {
      const execution = await api.post<TestExecution>(`/api/test-executions/${executionId}/steps/${stepId}/defects/link`, {
        workItemId,
      });
      onLinked(execution);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not link that defect.");
      setLinkingId(null);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">Link Existing Defect</h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
              <AlertCircle size={13} /> {error}
            </div>
          )}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search defects by key or title…"
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors"
          />
          <div className={CARD_CLASS + " min-h-[160px]"}>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-6 justify-center">
                <Loader2 size={14} className="animate-spin" /> Loading…
              </div>
            ) : visible.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">No matching defects.</p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {visible.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => handleLink(d.id)}
                    disabled={linkingId !== null}
                    className="w-full flex items-center justify-between gap-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-950/40 disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${WORK_ITEM_TYPE_BADGE_CLASS[d.type]}`}>
                        {d.key}
                      </span>
                      <span className="text-sm text-slate-800 dark:text-slate-200 truncate">{d.title}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                      {linkingId === d.id ? "Linking…" : d.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800">
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm font-medium px-3 py-2">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
