import { CheckCircle2, XCircle, AlertTriangle, MinusCircle } from "lucide-react";
import { ASSERTION_RESULT_BADGE_CLASS } from "../constants";
import type { AssertionResult, AssertionResultStatus } from "../types";

const STATUS_ICON = {
  PASS: CheckCircle2,
  FAIL: XCircle,
  ERROR: AlertTriangle,
  SKIPPED: MinusCircle,
};

const STATUS_ICON_CLASS: Record<AssertionResultStatus, string> = {
  PASS: "text-emerald-600 dark:text-emerald-400",
  FAIL: "text-red-600 dark:text-red-400",
  ERROR: "text-amber-600 dark:text-amber-400",
  SKIPPED: "text-slate-400 dark:text-slate-500",
};

export default function AssertionResults({ results }: { results: AssertionResult[] }) {
  if (results.length === 0) return null;

  const passed = results.filter((r) => r.status === "PASS").length;
  const allPassed = passed === results.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-slate-900 dark:text-white">Test Results</h3>
        <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${allPassed ? ASSERTION_RESULT_BADGE_CLASS.PASS : ASSERTION_RESULT_BADGE_CLASS.FAIL}`}>
          {passed}/{results.length} Passed
        </span>
      </div>
      <div className="space-y-1">
        {results.map((result) => {
          const Icon = STATUS_ICON[result.status];
          return (
            <div key={result.id} className="flex items-start gap-2 text-xs py-1">
              <Icon size={14} className={`shrink-0 mt-0.5 ${STATUS_ICON_CLASS[result.status]}`} />
              <div className="min-w-0 flex-1">
                <div className="text-slate-700 dark:text-slate-300">{result.name}</div>
                {result.status !== "PASS" && (
                  <div className="text-slate-400 dark:text-slate-500">
                    {result.message}
                    {result.evidence && <span className="text-slate-300 dark:text-slate-600"> — {result.evidence}</span>}
                  </div>
                )}
              </div>
              {result.expected !== null && (
                <div className="text-slate-400 dark:text-slate-500 shrink-0 text-right">
                  {result.actual !== null ? `${result.actual}` : "—"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
