import { useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { EXECUTION_STATUS_BADGE_CLASS, OVERALL_RESULT_BADGE_CLASS } from "../constants";
import AssertionResults from "./AssertionResults";
import type { ApiExecution } from "../types";

function prettyBody(body: string | null): string {
  if (!body) return "";
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

export default function ResponseViewer({
  execution,
  onRerun,
  rerunning = false,
}: {
  execution: ApiExecution;
  onRerun?: () => void;
  rerunning?: boolean;
}) {
  const [bodyView, setBodyView] = useState<"pretty" | "raw">("pretty");

  function copyHeaders() {
    if (!execution.responseHeaders) return;
    const text = Object.entries(execution.responseHeaders)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <span className={`inline-block font-medium px-2 py-0.5 rounded-full ${EXECUTION_STATUS_BADGE_CLASS[execution.status]}`}>
          {execution.status}
        </span>
        {execution.overallResult && (
          <span className={`inline-block font-medium px-2 py-0.5 rounded-full ${OVERALL_RESULT_BADGE_CLASS[execution.overallResult]}`}>
            Test: {execution.overallResult}
          </span>
        )}
        {execution.statusCode !== null && (
          <span className="text-slate-500 dark:text-slate-400">Status {execution.statusCode}</span>
        )}
        {execution.durationMs !== null && (
          <span className="text-slate-400 dark:text-slate-500">{execution.durationMs} ms</span>
        )}
        {execution.responseSizeBytes !== null && (
          <span className="text-slate-400 dark:text-slate-500">
            {execution.responseSizeBytes} bytes{execution.responseTruncated ? " (truncated)" : ""}
          </span>
        )}
        {execution.retestOfId && <span className="text-slate-400 dark:text-slate-500 italic">rerun (no request sent)</span>}
        {onRerun && (
          <button
            onClick={onRerun}
            disabled={rerunning}
            className="ml-auto inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
            title="Re-evaluate assertions against this same response without resending the request"
          >
            <RefreshCw size={11} className={rerunning ? "animate-spin" : ""} /> Rerun Assertions
          </button>
        )}
      </div>

      {execution.errorMessage && (
        <p className="text-xs text-red-500 dark:text-red-400">{execution.errorMessage}</p>
      )}

      {execution.assertionResults && execution.assertionResults.length > 0 && <AssertionResults results={execution.assertionResults} />}

      {execution.responseBody && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Body</div>
            <div className="flex items-center gap-1 text-[11px]">
              <button
                onClick={() => setBodyView("pretty")}
                className={`px-2 py-0.5 rounded ${bodyView === "pretty" ? "bg-indigo-600 text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
              >
                Pretty
              </button>
              <button
                onClick={() => setBodyView("raw")}
                className={`px-2 py-0.5 rounded ${bodyView === "raw" ? "bg-indigo-600 text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
              >
                Raw
              </button>
            </div>
          </div>
          <pre className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs text-slate-700 dark:text-slate-300 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-words">
            {bodyView === "pretty" ? prettyBody(execution.responseBody) : execution.responseBody}
          </pre>
        </div>
      )}

      {execution.responseHeaders && Object.keys(execution.responseHeaders).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Headers</div>
            <button onClick={copyHeaders} className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline">
              <Copy size={11} /> Copy All
            </button>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs text-slate-700 dark:text-slate-300 space-y-0.5 max-h-48 overflow-y-auto">
            {Object.entries(execution.responseHeaders).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <span className="text-slate-400 dark:text-slate-500 shrink-0">{key}:</span>
                <span className="break-all">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
