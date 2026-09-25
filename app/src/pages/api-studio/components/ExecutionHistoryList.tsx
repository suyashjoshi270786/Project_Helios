import { executionOutcome, OVERALL_RESULT_BADGE_CLASS, statusCodeToneClass } from "../constants";
import type { ApiExecution } from "../types";

export default function ExecutionHistoryList({
  executions,
  onSelect,
}: {
  executions: ApiExecution[];
  onSelect: (execution: ApiExecution) => void;
}) {
  if (executions.length === 0) {
    return <p className="text-xs text-slate-400 dark:text-slate-500 py-2">No executions yet — click Send to run this request.</p>;
  }

  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {executions.map((execution) => {
        const outcome = executionOutcome(execution);
        return (
        <button
          key={execution.id}
          onClick={() => onSelect(execution)}
          className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors text-xs"
        >
          <span className={`inline-block font-medium px-2 py-0.5 rounded-full shrink-0 ${outcome.badgeClass}`}>{outcome.label}</span>
          {execution.overallResult && (
            <span className={`inline-block font-medium px-2 py-0.5 rounded-full shrink-0 ${OVERALL_RESULT_BADGE_CLASS[execution.overallResult]}`}>
              {execution.overallResult}
            </span>
          )}
          <span className={`shrink-0 ${statusCodeToneClass(execution.statusCode)}`}>{execution.statusCode ?? "—"}</span>
          <span className="text-slate-400 dark:text-slate-500 shrink-0">{execution.durationMs !== null ? `${execution.durationMs} ms` : "—"}</span>
          <span className="text-slate-400 dark:text-slate-500 flex-1 truncate text-right">
            {new Date(execution.completedAt).toLocaleString()}
          </span>
        </button>
        );
      })}
    </div>
  );
}
