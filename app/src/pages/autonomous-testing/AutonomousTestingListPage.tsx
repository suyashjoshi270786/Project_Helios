import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, Bot, Trash2 } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useProject } from "../../projects/ProjectContext";
import ConfirmDeleteModal from "../../components/ConfirmDeleteModal";
import { CARD_CLASS, RUN_STATUS_BADGE_CLASS, RUN_STATUS_LABELS } from "./constants";
import type { AutonomousRunSummary } from "./types";

const ACTIVE_STATUSES = new Set(["Pending", "Running"]);

export default function AutonomousTestingListPage() {
  const { currentProjectId, currentProject, loading: projectLoading } = useProject();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<AutonomousRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Owners/Admins only — same gate as Test Cycles' bulk delete.
  const canDelete = currentProject && currentProject.myRole !== "Member";
  // A run still in progress can't be selected for deletion — its orchestrator
  // is actively writing to it; stop it first, then delete once terminal.
  const selectableRuns = runs.filter((r) => !ACTIVE_STATUSES.has(r.status));

  useEffect(() => {
    if (!currentProjectId) {
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const list = await api.get<AutonomousRunSummary[]>(`/api/autonomous-testing/runs?projectId=${currentProjectId}`);
      setRuns(list);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load autonomous testing runs.");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === selectableRuns.length ? new Set() : new Set(selectableRuns.map((r) => r.id)),
    );
  }

  async function handleBulkDelete() {
    try {
      await api.post("/api/autonomous-testing/runs/bulk-delete", { ids: [...selectedIds] });
      setShowDeleteConfirm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete the selected runs.");
      setShowDeleteConfirm(false);
    }
  }

  if (!projectLoading && !currentProjectId) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Autonomous Testing</h1>
        <div className={CARD_CLASS + " text-center text-sm text-slate-400 dark:text-slate-500"}>
          Create a project first — Autonomous Testing runs live inside a project.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Autonomous Testing</h1>
          {currentProject && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Project: {currentProject.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canDelete && selectedIds.size > 0 && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-xs font-medium rounded-lg px-3.5 py-2"
            >
              <Trash2 size={13} /> Delete Selected ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => navigate("/autonomous-testing/new")}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
          >
            <Plus size={13} /> Start Autonomous Testing
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      <div className={CARD_CLASS}>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-6 justify-center">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-10 text-sm text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
            <Bot size={20} className="text-slate-300 dark:text-slate-700" />
            No autonomous runs yet. Start one to explore, generate, and execute tests for a web application.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                {canDelete && (
                  <th className="py-2 font-medium w-8">
                    <input
                      type="checkbox"
                      checked={selectableRuns.length > 0 && selectedIds.size === selectableRuns.length}
                      onChange={toggleSelectAll}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Select all runs"
                    />
                  </th>
                )}
                <th className="py-2 font-medium">Application</th>
                <th className="py-2 font-medium">Environment</th>
                <th className="py-2 font-medium">Stage</th>
                <th className="py-2 font-medium">Results</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {runs.map((run) => (
                <tr
                  key={run.id}
                  onClick={() => navigate(`/autonomous-testing/${run.id}`)}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950/40"
                >
                  {canDelete && (
                    <td className="py-3" onClick={(e) => e.stopPropagation()}>
                      {!ACTIVE_STATUSES.has(run.status) && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(run.id)}
                          onChange={() => toggleSelected(run.id)}
                          aria-label={`Select ${run.appName || run.targetUrl}`}
                        />
                      )}
                    </td>
                  )}
                  <td className="py-3 font-medium text-slate-900 dark:text-white">
                    {run.appName || new URL(run.targetUrl).host}
                  </td>
                  <td className="py-3 text-slate-500 dark:text-slate-400">{run.environment || "—"}</td>
                  <td className="py-3 text-slate-500 dark:text-slate-400">{run.currentStage || "—"}</td>
                  <td className="py-3 text-slate-500 dark:text-slate-400">
                    {run.testsPassed + run.testsFailed > 0
                      ? `${run.testsPassed} passed, ${run.testsFailed} failed, ${run.defectsCreated} defect(s)`
                      : "—"}
                  </td>
                  <td className="py-3">
                    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${RUN_STATUS_BADGE_CLASS[run.status]}`}>
                      {RUN_STATUS_LABELS[run.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showDeleteConfirm && (
        <ConfirmDeleteModal
          title="Delete Autonomous Runs"
          message={`This permanently deletes ${selectedIds.size} selected run(s) and their stage history. Test cases/cycles/defects they generated are kept — only the run record itself is removed. This cannot be undone.`}
          confirmLabel={`Delete ${selectedIds.size}`}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleBulkDelete}
        />
      )}
    </div>
  );
}
