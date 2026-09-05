import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Workflow as WorkflowIcon } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useProject } from "../../projects/ProjectContext";
import ConfirmDeleteModal from "../../components/ConfirmDeleteModal";
import { BUTTON_PRIMARY_CLASS, CARD_CLASS, INPUT_CLASS } from "./constants";
import type { ApiWorkflow } from "./types";

export default function WorkflowsPage() {
  const { currentProjectId } = useProject();
  const navigate = useNavigate();

  const [workflows, setWorkflows] = useState<ApiWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId]);

  async function load() {
    if (!currentProjectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const list = await api.get<ApiWorkflow[]>(`/api/api-studio/workflows?projectId=${currentProjectId}`);
      setWorkflows(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load workflows.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!currentProjectId || !newName.trim()) return;
    try {
      const workflow = await api.post<ApiWorkflow>("/api/api-studio/workflows", { projectId: currentProjectId, name: newName.trim() });
      navigate(`/api-studio/workflows/${workflow.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create workflow.");
    }
  }

  async function handleDelete() {
    if (!pendingDeleteId) return;
    try {
      await api.delete(`/api/api-studio/workflows/${pendingDeleteId}`);
      setWorkflows((prev) => prev.filter((w) => w.id !== pendingDeleteId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this workflow.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  if (!currentProjectId) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">Create a project first — workflows live inside a project.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
          <WorkflowIcon size={14} className="text-slate-400" /> Workflows
        </h2>
        {!creating && (
          <button onClick={() => setCreating(true)} className={BUTTON_PRIMARY_CLASS}>
            <Plus size={13} /> New Workflow
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      {creating && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setCreating(false);
            }}
            placeholder="Workflow name…"
            className={INPUT_CLASS + " text-sm"}
          />
          <button onClick={handleCreate} className={BUTTON_PRIMARY_CLASS}>
            Create
          </button>
          <button onClick={() => setCreating(false)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            Cancel
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">Loading…</p>
      ) : workflows.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 py-6 text-center">
          No workflows yet — chain multiple requests together with data passed between them.
        </p>
      ) : (
        <div className="space-y-2">
          {workflows.map((w) => (
            <div
              key={w.id}
              onClick={() => navigate(`/api-studio/workflows/${w.id}`)}
              className={CARD_CLASS + " flex items-center justify-between gap-3 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors py-3"}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{w.name}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {(w.steps?.length ?? 0)} step{(w.steps?.length ?? 0) === 1 ? "" : "s"} · {w.failurePolicy}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingDeleteId(w.id);
                }}
                title="Delete Workflow"
                className="text-slate-400 hover:text-red-400 shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {pendingDeleteId && (
        <ConfirmDeleteModal
          title="Delete Workflow"
          message="This permanently deletes this workflow and its run history. This cannot be undone."
          confirmLabel="Delete"
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
