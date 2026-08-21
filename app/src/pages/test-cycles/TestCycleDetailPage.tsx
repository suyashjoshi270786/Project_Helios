import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import {
  CARD_CLASS,
  SELECT_CLASS,
  TEST_CASE_ENVIRONMENT_OPTIONS,
  EXECUTION_STATUS_LABELS,
  EXECUTION_STATUS_BADGE_CLASS,
} from "./constants";
import type { TestCycleDetail } from "./types";

export default function TestCycleDetailPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const navigate = useNavigate();

  const [cycle, setCycle] = useState<TestCycleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkEnvironment, setBulkEnvironment] = useState("");
  const [bulkTester, setBulkTester] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (cycleId) load(cycleId);
  }, [cycleId]);

  async function load(id: string) {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<TestCycleDetail>(`/api/test-cycles/${id}`);
      setCycle(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this test cycle.");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleRemove(cycleTestId: string) {
    if (!cycle || !window.confirm("Remove this test case from the cycle?")) return;
    try {
      await api.delete(`/api/test-cycles/${cycle.id}/tests/${cycleTestId}`);
      setCycle((prev) => (prev ? { ...prev, tests: prev.tests.filter((t) => t.id !== cycleTestId) } : prev));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(cycleTestId);
        return next;
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove this test case.");
    }
  }

  async function handleApplyBulk() {
    if (!cycle || selected.size === 0) return;
    setApplying(true);
    setError("");
    try {
      await api.patch(`/api/test-cycles/${cycle.id}/tests/bulk`, {
        testCycleTestIds: [...selected],
        environment: bulkEnvironment || undefined,
        tester: bulkTester.trim() || undefined,
      });
      await load(cycle.id);
      setSelected(new Set());
      setBulkEnvironment("");
      setBulkTester("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not apply the bulk update.");
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-10 justify-center">
        <Loader2 size={14} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="space-y-4">
        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
        <button onClick={() => navigate("/test-cycles")} className="text-sm text-blue-500 hover:underline">
          Back to Test Cycles
        </button>
      </div>
    );
  }

  const { summary } = cycle;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <button onClick={() => navigate("/test-cycles")} className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-400 hover:underline mb-1">
            Test Cycles
          </button>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{cycle.name}</h1>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {cycle.testPhase}
            {cycle.environment ? ` · ${cycle.environment}` : ""}
          </p>
        </div>
        <button
          onClick={() => navigate(`/test-cycles/${cycle.id}/select-tests`)}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
        >
          <Plus size={13} /> Select Test / Add Test
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      <div className={CARD_CLASS + " grid grid-cols-5 gap-4 text-center"}>
        <div>
          <div className="text-xl font-semibold text-slate-900 dark:text-white">{summary.total}</div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Total</div>
        </div>
        <div>
          <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">{summary.passed}</div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Passed</div>
        </div>
        <div>
          <div className="text-xl font-semibold text-red-600 dark:text-red-400">{summary.failed}</div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Failed</div>
        </div>
        <div>
          <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">{summary.blocked}</div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Blocked</div>
        </div>
        <div>
          <div className="text-xl font-semibold text-slate-500 dark:text-slate-400">{summary.notExecuted}</div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Not Executed</div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className={CARD_CLASS + " flex items-center gap-3 flex-wrap"}>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{selected.size} Test Cases Selected</span>
          <select value={bulkEnvironment} onChange={(e) => setBulkEnvironment(e.target.value)} className={SELECT_CLASS + " w-auto"}>
            <option value="">Environment…</option>
            {TEST_CASE_ENVIRONMENT_OPTIONS.map((env) => (
              <option key={env} value={env}>
                {env}
              </option>
            ))}
          </select>
          <input
            value={bulkTester}
            onChange={(e) => setBulkTester(e.target.value)}
            placeholder="Tester name…"
            className={SELECT_CLASS + " w-auto"}
          />
          <button
            onClick={handleApplyBulk}
            disabled={applying || (!bulkEnvironment && !bulkTester.trim())}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
          >
            {applying ? "Applying…" : "Apply"}
          </button>
        </div>
      )}

      <div className={CARD_CLASS}>
        {cycle.tests.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
            No test cases in this cycle yet. Click "Select Test / Add Test" to add some.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <th className="py-2 font-medium w-8"></th>
                <th className="py-2 font-medium">Test Case</th>
                <th className="py-2 font-medium">Environment</th>
                <th className="py-2 font-medium">Tester</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {cycle.tests.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/40">
                  <td className="py-2.5">
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelected(t.id)} />
                  </td>
                  <td
                    className="py-2.5 font-medium text-slate-900 dark:text-white cursor-pointer hover:text-blue-500"
                    onClick={() => navigate(`/test-cycles/${cycle.id}/execute/${t.id}`)}
                  >
                    {t.testCase.code} {t.testCase.name}
                  </td>
                  <td className="py-2.5 text-slate-500 dark:text-slate-400">{t.environment || "—"}</td>
                  <td className="py-2.5 text-slate-500 dark:text-slate-400">{t.tester || "—"}</td>
                  <td className="py-2.5">
                    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${EXECUTION_STATUS_BADGE_CLASS[t.status]}`}>
                      {EXECUTION_STATUS_LABELS[t.status]}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <button onClick={() => handleRemove(t.id)} title="Remove from cycle" className="text-slate-400 hover:text-red-400">
                      <Trash2 size={13} />
                    </button>
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
