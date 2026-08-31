import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Bot, Loader2, Square, ExternalLink } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import StatTile from "../../components/StatTile";
import StageTimeline from "./components/StageTimeline";
import { CARD_CLASS, BUTTON_SECONDARY_CLASS, POLL_INTERVAL_MS, RUN_STATUS_BADGE_CLASS, RUN_STATUS_LABELS } from "./constants";
import type { AutonomousReport, AutonomousRun } from "./types";

const TERMINAL_STATUSES = new Set(["Completed", "Failed", "Cancelled"]);

function ReportSummary({ report }: { report: AutonomousReport }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <StatTile label="Tests Run" value={report.testSummary.total} icon={Bot} tint="bg-slate-100 dark:bg-slate-800 text-slate-500" />
        <StatTile
          label="Passed"
          value={report.testSummary.passed}
          icon={Bot}
          tint="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600"
        />
        <StatTile label="Failed" value={report.testSummary.failed} icon={Bot} tint="bg-red-100 dark:bg-red-900/40 text-red-600" />
        <StatTile
          label="Defects Filed"
          value={report.qualitySignals.potentialDefects}
          icon={Bot}
          tint="bg-amber-100 dark:bg-amber-900/40 text-amber-600"
        />
      </div>

      <div className={`${CARD_CLASS} space-y-2`}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Discovered Application</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <div className="text-slate-400 dark:text-slate-500">Pages</div>
            <div className="text-slate-800 dark:text-slate-200 font-medium">{report.discoveredApplication.pages}</div>
          </div>
          <div>
            <div className="text-slate-400 dark:text-slate-500">Workflows</div>
            <div className="text-slate-800 dark:text-slate-200 font-medium">{report.discoveredApplication.workflows}</div>
          </div>
          <div>
            <div className="text-slate-400 dark:text-slate-500">Forms</div>
            <div className="text-slate-800 dark:text-slate-200 font-medium">{report.discoveredApplication.forms}</div>
          </div>
          <div>
            <div className="text-slate-400 dark:text-slate-500">Interactive Elements</div>
            <div className="text-slate-800 dark:text-slate-200 font-medium">{report.discoveredApplication.interactiveElements}</div>
          </div>
        </div>
      </div>

      <div className={`${CARD_CLASS} space-y-2`}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Generated Tests</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {report.generatedTests.bddScenarios} BDD scenario(s), {report.generatedTests.automatedScenarios} automated test case(s) —
          view them in{" "}
          <a href="/test-cases" className="text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-0.5">
            Test Cases <ExternalLink size={11} />
          </a>
          .
        </p>
      </div>

      {report.failureAnalysis.length > 0 && (
        <div className={`${CARD_CLASS} space-y-3`}>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Failure Analysis</h3>
          {report.failureAnalysis.map((f, i) => (
            <div key={i} className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{f.category}</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">{Math.round(f.confidence * 100)}% confidence</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{f.rootCause}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Recommended: {f.recommendedAction}</p>
              {f.defectKey && (
                <a href="/work-items" className="text-[11px] text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-0.5">
                  Defect {f.defectKey} <ExternalLink size={10} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {report.recommendations.length > 0 && (
        <div className={`${CARD_CLASS} space-y-2`}>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recommendations</h3>
          <ul className="list-disc pl-4 space-y-1">
            {report.recommendations.map((r, i) => (
              <li key={i} className="text-xs text-slate-500 dark:text-slate-400">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<AutonomousRun | null>(null);
  const [report, setReport] = useState<AutonomousReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stopping, setStopping] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  async function load() {
    if (!runId) return;
    try {
      const data = await api.get<AutonomousRun>(`/api/autonomous-testing/runs/${runId}`);
      setRun(data);
      if (TERMINAL_STATUSES.has(data.status)) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (data.status === "Completed" && !report) {
          api
            .get<AutonomousReport>(`/api/autonomous-testing/runs/${runId}/report`)
            .then(setReport)
            .catch(() => {});
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this run.");
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    if (!runId) return;
    setStopping(true);
    try {
      await api.post(`/api/autonomous-testing/runs/${runId}/stop`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not stop this run.");
    } finally {
      setStopping(false);
    }
  }

  if (loading && !run) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-10 justify-center">
        <Loader2 size={14} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (error && !run) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        <button onClick={() => navigate("/autonomous-testing")} className={BUTTON_SECONDARY_CLASS}>
          Back to Autonomous Testing
        </button>
      </div>
    );
  }

  if (!run) return null;

  const active = run.status === "Pending" || run.status === "Running";

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Bot size={18} className="text-indigo-600 dark:text-indigo-400" />
            {run.appName || new URL(run.targetUrl).host}
          </h1>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {run.targetUrl}
            {run.environment ? ` · ${run.environment}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${RUN_STATUS_BADGE_CLASS[run.status]}`}>
            {RUN_STATUS_LABELS[run.status]}
          </span>
          {active && (
            <button onClick={handleStop} disabled={stopping} className={BUTTON_SECONDARY_CLASS}>
              {stopping ? <Loader2 size={13} className="animate-spin" /> : <Square size={12} />} Stop Run
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      {run.errorMessage && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-lg px-3 py-2 max-h-40 overflow-y-auto">
          <p className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">{run.errorMessage}</p>
        </div>
      )}

      {report ? (
        <ReportSummary report={report} />
      ) : (
        <div className={CARD_CLASS}>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Pipeline Progress</h2>
          <StageTimeline stages={run.stages} />
        </div>
      )}
    </div>
  );
}
