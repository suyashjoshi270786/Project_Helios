import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ListChecks, Loader2, Plus } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useProject } from "../../projects/ProjectContext";
import type { TestPlan } from "./types";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  UNDER_REVIEW: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  GENERATING: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  GENERATED: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  APPROVED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  REJECTED: "bg-red-500/15 text-red-400 border-red-500/30",
  SUPERSEDED: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

export default function TestPlanListPage() {
  const { currentProjectId, currentProject, loading: projectLoading } = useProject();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!currentProjectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get<TestPlan[]>(`/api/test-plans?projectId=${currentProjectId}`)
      .then(setPlans)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load test plans."))
      .finally(() => setLoading(false));
  }, [currentProjectId]);

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

  if (!projectLoading && !currentProjectId) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Test Planning</h1>
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-sm text-slate-400 dark:text-slate-500">
          Create a project first — Test Plans live inside a project.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Test Planning</h1>
          {currentProject && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Project: {currentProject.name}</p>
          )}
        </div>
        <button
          onClick={handleNewPlan}
          disabled={creating}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
        >
          {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          New Test Plan
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">Loading…</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-500 dark:text-red-400">{error}</div>
        ) : plans.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
            <ListChecks size={18} className="text-slate-300 dark:text-slate-700" />
            No test plans yet. Approve some requirements, then create a test plan from the Requirements page —
            or start a new one here.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {plans.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/test-planning/${p.id}`)}
                className="w-full flex items-center justify-between gap-4 px-5 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {p.name?.trim() || "Untitled Test Plan"}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {p.planCode} · v{p.version} · {p.requirementCount ?? 0} requirement
                    {(p.requirementCount ?? 0) === 1 ? "" : "s"}
                  </div>
                </div>
                <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${STATUS_STYLES[p.status]}`}>
                  {p.status.replace("_", " ")}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
