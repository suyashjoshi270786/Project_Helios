import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { ArrowLeft, ArrowDown, ArrowUp, Loader2, Play, Plus, Save, Trash2 } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import {
  BUTTON_PRIMARY_CLASS,
  BUTTON_SECONDARY_CLASS,
  CARD_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  OVERALL_RESULT_BADGE_CLASS,
  SELECT_CLASS,
  TEXTAREA_CLASS,
  WORKFLOW_FAILURE_POLICY_OPTIONS,
  WORKFLOW_STEP_STATUS_BADGE_CLASS,
  newId,
} from "./constants";
import MethodBadge from "./components/MethodBadge";
import type { ApiStudioOutletContext } from "./ApiStudioLayout";
import type { ApiRequest, ApiWorkflow, ApiWorkflowRun, WorkflowExtraction, WorkflowFailurePolicy, WorkflowStep } from "./types";

type Draft = {
  name: string;
  description: string;
  failurePolicy: WorkflowFailurePolicy;
  steps: WorkflowStep[];
};

function toDraft(workflow: ApiWorkflow): Draft {
  return {
    name: workflow.name,
    description: workflow.description ?? "",
    failurePolicy: workflow.failurePolicy,
    steps: (workflow.steps ?? []).slice().sort((a, b) => a.order - b.order),
  };
}

function renumber(steps: WorkflowStep[]): WorkflowStep[] {
  return steps.map((s, i) => ({ ...s, order: i }));
}

export default function WorkflowDetailPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();
  const { selectedEnvironmentId } = useOutletContext<ApiStudioOutletContext>();

  const [workflow, setWorkflow] = useState<ApiWorkflow | null>(null);
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [runs, setRuns] = useState<ApiWorkflowRun[]>([]);
  const [activeRun, setActiveRun] = useState<ApiWorkflowRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const isDirty = useMemo(() => draft !== null && savedSnapshot !== null && JSON.stringify(draft) !== JSON.stringify(savedSnapshot), [draft, savedSnapshot]);
  const requestById = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const loaded = await api.get<ApiWorkflow>(`/api/api-studio/workflows/${workflowId}`);
      const [requestList, runList] = await Promise.all([
        api.get<ApiRequest[]>(`/api/api-studio/requests?projectId=${loaded.projectId}`),
        api.get<ApiWorkflowRun[]>(`/api/api-studio/workflows/${workflowId}/runs`),
      ]);
      setWorkflow(loaded);
      setRequests(requestList);
      setRuns(runList);
      setActiveRun(runList[0] ?? null);
      const snapshot = toDraft(loaded);
      setDraft(snapshot);
      setSavedSnapshot(snapshot);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this workflow.");
    } finally {
      setLoading(false);
    }
  }

  function patchDraft(patch: Partial<Draft>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function addStep() {
    if (!draft || requests.length === 0) return;
    const step: WorkflowStep = { id: newId(), order: draft.steps.length, apiRequestId: requests[0].id, extractions: [] };
    patchDraft({ steps: [...draft.steps, step] });
  }

  function updateStep(stepId: string, patch: Partial<WorkflowStep>) {
    if (!draft) return;
    patchDraft({ steps: draft.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) });
  }

  function removeStep(stepId: string) {
    if (!draft) return;
    patchDraft({ steps: renumber(draft.steps.filter((s) => s.id !== stepId)) });
  }

  function moveStep(index: number, direction: -1 | 1) {
    if (!draft) return;
    const target = index + direction;
    if (target < 0 || target >= draft.steps.length) return;
    const steps = draft.steps.slice();
    [steps[index], steps[target]] = [steps[target], steps[index]];
    patchDraft({ steps: renumber(steps) });
  }

  function addExtraction(stepId: string) {
    if (!draft) return;
    const step = draft.steps.find((s) => s.id === stepId);
    if (!step) return;
    const extraction: WorkflowExtraction = { id: newId(), source: "jsonPath", path: "", variableName: "" };
    updateStep(stepId, { extractions: [...(step.extractions ?? []), extraction] });
  }

  function updateExtraction(stepId: string, extractionId: string, patch: Partial<WorkflowExtraction>) {
    const step = draft?.steps.find((s) => s.id === stepId);
    if (!step) return;
    updateStep(stepId, { extractions: (step.extractions ?? []).map((e) => (e.id === extractionId ? { ...e, ...patch } : e)) });
  }

  function removeExtraction(stepId: string, extractionId: string) {
    const step = draft?.steps.find((s) => s.id === stepId);
    if (!step) return;
    updateStep(stepId, { extractions: (step.extractions ?? []).filter((e) => e.id !== extractionId) });
  }

  async function handleSave() {
    if (!workflow || !draft) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api.patch<ApiWorkflow>(`/api/api-studio/workflows/${workflow.id}`, {
        name: draft.name.trim() || workflow.name,
        description: draft.description.trim() || null,
        failurePolicy: draft.failurePolicy,
        steps: draft.steps,
      });
      setWorkflow(updated);
      const snapshot = toDraft(updated);
      setDraft(snapshot);
      setSavedSnapshot(snapshot);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this workflow.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRun() {
    if (!workflow) return;
    setRunning(true);
    setError("");
    try {
      const run = await api.post<ApiWorkflowRun>(`/api/api-studio/workflows/${workflow.id}/run`, { environmentId: selectedEnvironmentId });
      setRuns((prev) => [run, ...prev]);
      setActiveRun(run);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not run this workflow.");
    } finally {
      setRunning(false);
    }
  }

  async function handleDelete() {
    if (!workflow) return;
    try {
      await api.delete(`/api/api-studio/workflows/${workflow.id}`);
      navigate("/api-studio/workflows");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this workflow.");
    }
  }

  if (loading || !draft) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-6 justify-center">
        <Loader2 size={14} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (!workflow) {
    return <p className="text-sm text-red-500 dark:text-red-400">{error || "Workflow not found."}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => navigate("/api-studio/workflows")} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0">
            <ArrowLeft size={15} />
          </button>
          <input
            value={draft.name}
            onChange={(e) => patchDraft({ name: e.target.value })}
            className="text-lg font-semibold text-slate-900 dark:text-white bg-transparent outline-none border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 transition-colors min-w-0"
          />
          {isDirty && <span title="Unsaved changes" className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleRun} disabled={running || draft.steps.length === 0} className={BUTTON_PRIMARY_CLASS}>
            <Play size={13} /> {running ? "Running…" : "Run Workflow"}
          </button>
          <button onClick={handleSave} disabled={saving || !isDirty} className={BUTTON_SECONDARY_CLASS}>
            <Save size={13} /> {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={handleDelete} className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-xs font-medium rounded-lg px-3 py-1.5">
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      <div className={CARD_CLASS + " space-y-4"}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Description</label>
            <textarea value={draft.description} onChange={(e) => patchDraft({ description: e.target.value })} rows={2} className={TEXTAREA_CLASS} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Failure policy</label>
            <select value={draft.failurePolicy} onChange={(e) => patchDraft({ failurePolicy: e.target.value as WorkflowFailurePolicy })} className={SELECT_CLASS}>
              {WORKFLOW_FAILURE_POLICY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              {WORKFLOW_FAILURE_POLICY_OPTIONS.find((o) => o.value === draft.failurePolicy)?.description}
            </p>
          </div>
        </div>
      </div>

      <div className={CARD_CLASS + " space-y-3"}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">Steps</h2>
          <button onClick={addStep} disabled={requests.length === 0} className={BUTTON_SECONDARY_CLASS}>
            <Plus size={13} /> Add Step
          </button>
        </div>
        {requests.length === 0 && <p className="text-xs text-amber-600 dark:text-amber-400">Create at least one request in this project before building a workflow.</p>}
        {draft.steps.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">No steps yet — add the requests you want to chain, in order.</p>
        ) : (
          <div className="space-y-3">
            {draft.steps.map((step, index) => {
              const request = requestById.get(step.apiRequestId);
              const trace = activeRun?.steps.find((t) => t.stepId === step.id);
              return (
                <div key={step.id} className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 dark:text-slate-600 w-5 shrink-0">#{index + 1}</span>
                    {request && <MethodBadge method={request.method} compact />}
                    <select value={step.apiRequestId} onChange={(e) => updateStep(step.id, { apiRequestId: e.target.value })} className={SELECT_CLASS + " text-xs py-1.5"}>
                      {requests.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    {trace && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${WORKFLOW_STEP_STATUS_BADGE_CLASS[trace.status]}`}>{trace.status}</span>
                    )}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={() => moveStep(index, -1)} disabled={index === 0} title="Move up" className="text-slate-400 hover:text-indigo-500 disabled:opacity-30">
                        <ArrowUp size={13} />
                      </button>
                      <button onClick={() => moveStep(index, 1)} disabled={index === draft.steps.length - 1} title="Move down" className="text-slate-400 hover:text-indigo-500 disabled:opacity-30">
                        <ArrowDown size={13} />
                      </button>
                      <button onClick={() => removeStep(step.id)} title="Remove step" className="text-slate-400 hover:text-red-400">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="pl-7 space-y-1.5">
                    <p className="text-[10px] tracking-widest text-slate-400 dark:text-slate-600">EXTRACT VARIABLES</p>
                    {(step.extractions ?? []).map((ext) => (
                      <div key={ext.id} className="flex items-center gap-1.5">
                        <select value={ext.source} onChange={(e) => updateExtraction(step.id, ext.id, { source: e.target.value as WorkflowExtraction["source"] })} className={SELECT_CLASS + " w-28 text-xs py-1"}>
                          <option value="jsonPath">JSON Path</option>
                          <option value="header">Header</option>
                        </select>
                        <input
                          value={ext.path}
                          onChange={(e) => updateExtraction(step.id, ext.id, { path: e.target.value })}
                          placeholder={ext.source === "jsonPath" ? "$.data.id" : "x-request-id"}
                          className={INPUT_CLASS + " text-xs py-1"}
                        />
                        <span className="text-slate-400 text-xs shrink-0">→</span>
                        <input
                          value={ext.variableName}
                          onChange={(e) => updateExtraction(step.id, ext.id, { variableName: e.target.value })}
                          placeholder="variableName"
                          className={INPUT_CLASS + " text-xs py-1"}
                        />
                        {trace?.extractedVariables[ext.variableName] !== undefined && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0 truncate max-w-[120px]" title={trace.extractedVariables[ext.variableName]}>
                            = {trace.extractedVariables[ext.variableName]}
                          </span>
                        )}
                        <button onClick={() => removeExtraction(step.id, ext.id)} title="Remove" className="text-slate-400 hover:text-red-400 shrink-0">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => addExtraction(step.id)} className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline">
                      <Plus size={11} /> Add extraction
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeRun && (
        <div className={CARD_CLASS + " space-y-2"}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-900 dark:text-white">Last Run</h2>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${OVERALL_RESULT_BADGE_CLASS[activeRun.overallResult]}`}>{activeRun.overallResult}</span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">{new Date(activeRun.completedAt).toLocaleString()}</p>
          <div className="space-y-1.5">
            {activeRun.steps.map((trace, i) => {
              const request = requestById.get(trace.apiRequestId);
              return (
                <div key={trace.stepId} className="flex items-center gap-2 text-xs">
                  <span className="text-[10px] text-slate-400 dark:text-slate-600 w-5 shrink-0">#{i + 1}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${WORKFLOW_STEP_STATUS_BADGE_CLASS[trace.status]}`}>{trace.status}</span>
                  {trace.statusCode != null && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">{trace.statusCode}</span>
                  )}
                  {request ? (
                    <button onClick={() => navigate(`/api-studio/${request.id}`)} className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 truncate">
                      {request.name}
                    </button>
                  ) : (
                    <span className="text-slate-400">{trace.message ?? "Request not found"}</span>
                  )}
                  {Object.entries(trace.extractedVariables).length > 0 && (
                    <span className="text-slate-400 dark:text-slate-500 truncate">
                      {Object.entries(trace.extractedVariables).map(([k, v]) => `${k}=${v}`).join(", ")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {runs.length > 1 && (
        <div className={CARD_CLASS + " space-y-2"}>
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">Run History</h2>
          <div className="space-y-1">
            {runs.map((run) => (
              <button
                key={run.id}
                onClick={() => setActiveRun(run)}
                className={`w-full flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-lg transition-colors ${
                  activeRun?.id === run.id ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
                }`}
              >
                <span>{new Date(run.completedAt).toLocaleString()}</span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${OVERALL_RESULT_BADGE_CLASS[run.overallResult]}`}>{run.overallResult}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
