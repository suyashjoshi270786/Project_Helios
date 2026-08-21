import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, PlayCircle } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useProject } from "../../projects/ProjectContext";
import { CARD_CLASS } from "./constants";
import type { CycleSummary, TestCycle } from "./types";

const STATUS_BADGE: Record<string, string> = {
  NotStarted: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  InProgress: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",
  Completed: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
};

const STATUS_LABEL: Record<string, string> = {
  NotStarted: "Not Started",
  InProgress: "In Progress",
  Completed: "Completed",
};

function ProgressCell({ summary }: { summary: CycleSummary }) {
  const executed = summary.total - summary.notExecuted;
  const executedPct = summary.total === 0 ? 0 : Math.round((executed / summary.total) * 100);

  return (
    <div className="relative inline-block group/progress">
      <span className="cursor-default">
        {executed}/{summary.total} executed ({executedPct}%)
      </span>
      <div className="hidden group-hover/progress:block absolute z-20 left-0 top-full mt-1.5 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg p-3 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 dark:text-slate-500">Total</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">{summary.total}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-emerald-600 dark:text-emerald-400">Passed</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">{summary.passed}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-red-600 dark:text-red-400">Failed</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">{summary.failed}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-blue-600 dark:text-blue-400">Blocked</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">{summary.blocked}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-yellow-700 dark:text-yellow-400">Not Executed</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">{summary.notExecuted}</span>
        </div>
        <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 dark:border-slate-800">
          <span className="text-slate-400 dark:text-slate-500">Executed</span>
          <span className="font-semibold text-slate-900 dark:text-white">{executedPct}%</span>
        </div>
      </div>
    </div>
  );
}

export default function TestCyclesListPage() {
  const { currentProjectId, currentProject, loading: projectLoading } = useProject();
  const navigate = useNavigate();
  const [cycles, setCycles] = useState<TestCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      const list = await api.get<TestCycle[]>(`/api/test-cycles?projectId=${currentProjectId}`);
      setCycles(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load test cycles.");
    } finally {
      setLoading(false);
    }
  }

  if (!projectLoading && !currentProjectId) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Test Cycles</h1>
        <div className={CARD_CLASS + " text-center text-sm text-slate-400 dark:text-slate-500"}>
          Create a project first — Test Cycles live inside a project.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Test Cycles</h1>
          {currentProject && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Project: {currentProject.name}</p>
          )}
        </div>
        <button
          onClick={() => navigate("/test-cycles/new")}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
        >
          <Plus size={13} /> Create Test Cycle
        </button>
      </div>

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      <div className={CARD_CLASS}>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-6 justify-center">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : cycles.length === 0 ? (
          <div className="text-center py-10 text-sm text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
            <PlayCircle size={20} className="text-slate-300 dark:text-slate-700" />
            No test cycles yet. Create one to start executing your test cases.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <th className="py-2 font-medium">Test Cycle Name</th>
                <th className="py-2 font-medium">Phase</th>
                <th className="py-2 font-medium">Environment</th>
                <th className="py-2 font-medium">Progress</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {cycles.map((cycle) => (
                <tr
                  key={cycle.id}
                  onClick={() => navigate(`/test-cycles/${cycle.id}`)}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950/40"
                >
                  <td className="py-3 font-medium text-slate-900 dark:text-white">{cycle.name}</td>
                  <td className="py-3 text-slate-500 dark:text-slate-400">{cycle.testPhase}</td>
                  <td className="py-3 text-slate-500 dark:text-slate-400">{cycle.environment || "—"}</td>
                  <td className="py-3 text-slate-500 dark:text-slate-400">
                    <ProgressCell summary={cycle.summary} />
                  </td>
                  <td className="py-3">
                    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[cycle.status]}`}>
                      {STATUS_LABEL[cycle.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
