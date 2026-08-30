import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Download, FileText, ListChecks, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useProject } from "../../projects/ProjectContext";
import StatTile from "../../components/StatTile";
import { CARD_CLASS, INPUT_CLASS, BUTTON_PRIMARY_CLASS } from "../../lib/formStyles";
import type { TestPlan } from "./types";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  UNDER_REVIEW: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400",
  GENERATING: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400",
  GENERATED: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",
  APPROVED: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
  REJECTED: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400",
  SUPERSEDED: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
};

async function downloadDocument(plan: TestPlan, format: "docx" | "pdf") {
  const base = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
  const res = await fetch(`${base}/api/test-plans/${plan.id}/document?format=${format}`, { credentials: "include" });
  if (!res.ok) throw new Error("Could not download the document.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${plan.planCode}-v${plan.version}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function TestPlanListPage() {
  const { currentProjectId, currentProject, loading: projectLoading } = useProject();
  const navigate = useNavigate();
  const canWrite = !!currentProject && currentProject.myRole !== "Member";

  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentProjectId) {
      setLoading(false);
      return;
    }
    load();
  }, [currentProjectId]);

  function load() {
    setLoading(true);
    return api
      .get<TestPlan[]>(`/api/test-plans?projectId=${currentProjectId}`)
      .then(setPlans)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load test plans."))
      .finally(() => setLoading(false));
  }

  async function handleNewPlan() {
    if (!currentProjectId) return;
    setCreating(true);
    try {
      const plan = await api.post<TestPlan>("/api/test-plans", { projectId: currentProjectId });
      navigate(`/test-planning/${plan.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create a test plan.");
    } finally {
      setCreating(false);
    }
  }

  function startRename(plan: TestPlan, e: React.MouseEvent) {
    e.stopPropagation();
    setRenamingId(plan.id);
    setRenameDraft(plan.name ?? "");
  }

  async function saveRename(plan: TestPlan) {
    const name = renameDraft.trim();
    if (!name || name === plan.name) {
      setRenamingId(null);
      return;
    }
    setRenameSaving(true);
    try {
      const updated = await api.patch<TestPlan>(`/api/test-plans/${plan.id}`, { name });
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, ...updated } : p)));
      setRenamingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rename that test plan.");
    } finally {
      setRenameSaving(false);
    }
  }

  async function handleDelete(plan: TestPlan, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${plan.name || "Untitled Test Plan"}"? This cannot be undone.`)) return;
    setDeletingId(plan.id);
    try {
      await api.delete(`/api/test-plans/${plan.id}`);
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete that test plan.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDownload(plan: TestPlan, e: React.MouseEvent) {
    e.stopPropagation();
    setDownloadingId(plan.id);
    try {
      await downloadDocument(plan, "docx");
    } catch {
      setError("Could not download the document.");
    } finally {
      setDownloadingId(null);
    }
  }

  if (!projectLoading && !currentProjectId) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Test Planning</h1>
        <div className={CARD_CLASS + " text-center text-sm text-slate-400 dark:text-slate-500"}>
          Create a project first — Test Plans live inside a project.
        </div>
      </div>
    );
  }

  const approvedCount = plans.filter((p) => p.status === "APPROVED").length;
  const draftCount = plans.filter((p) => p.status === "DRAFT").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Test Planning</h1>
          {currentProject && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Project: {currentProject.name}</p>
          )}
        </div>
        <button onClick={handleNewPlan} disabled={creating} className={BUTTON_PRIMARY_CLASS}>
          {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          New Test Plan
        </button>
      </div>

      {!loading && plans.length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          <StatTile label="Total" value={plans.length} icon={FileText} tint="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400" />
          <StatTile label="Draft" value={draftCount} icon={Pencil} tint="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400" />
          <StatTile label="Approved" value={approvedCount} icon={CheckCircle2} tint="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400" />
        </div>
      )}

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      <div className={CARD_CLASS + " !p-0"}>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">Loading…</div>
        ) : plans.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
            <ListChecks size={18} className="text-slate-300 dark:text-slate-700" />
            No test plans yet. Approve some requirements, then create a test plan from the Requirements page —
            or start a new one here.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {plans.map((p) => (
              <div
                key={p.id}
                onClick={() => renamingId !== p.id && navigate(`/test-planning/${p.id}`)}
                className="w-full flex items-center justify-between gap-4 px-5 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  {renamingId === p.id ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveRename(p)}
                        className={INPUT_CLASS + " text-sm py-1.5"}
                      />
                      <button
                        onClick={() => saveRename(p)}
                        disabled={renameSaving}
                        className="text-emerald-600 hover:text-emerald-500 shrink-0"
                      >
                        {renameSaving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                      </button>
                      <button onClick={() => setRenamingId(null)} className="text-slate-400 hover:text-red-400 shrink-0">
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {p.name?.trim() || "Untitled Test Plan"}
                    </div>
                  )}
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {p.planCode} · v{p.version} · {p.requirementCount ?? 0} requirement
                    {(p.requirementCount ?? 0) === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[p.status]}`}>
                    {p.status.replace("_", " ")}
                  </span>
                  {!!p.generatedContent && (
                    <button
                      onClick={(e) => handleDownload(p, e)}
                      disabled={downloadingId === p.id}
                      title="Download docx"
                      className="text-slate-400 dark:text-slate-600 hover:text-indigo-500 transition-colors p-1.5 disabled:opacity-50"
                    >
                      {downloadingId === p.id ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                    </button>
                  )}
                  {canWrite && renamingId !== p.id && (
                    <button
                      onClick={(e) => startRename(p, e)}
                      title="Rename"
                      className="text-slate-400 dark:text-slate-600 hover:text-indigo-500 transition-colors p-1.5"
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  {canWrite && (
                    <button
                      onClick={(e) => handleDelete(p, e)}
                      disabled={deletingId === p.id}
                      title="Delete"
                      className="text-slate-400 dark:text-slate-600 hover:text-red-400 transition-colors p-1.5 disabled:opacity-50"
                    >
                      {deletingId === p.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
