import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, X } from "lucide-react";
import { api, ApiError } from "../../../lib/api";
import { INPUT_CLASS, TEXTAREA_CLASS, LABEL_CLASS, SELECT_CLASS } from "../constants";
import { DEFECT_SEVERITY_OPTIONS, WORK_ITEM_PRIORITY_OPTIONS } from "../../work-items/constants";
import type { TestExecution } from "../types";

export default function CreateDefectModal({
  executionId,
  stepId,
  prefill,
  onClose,
  onCreated,
}: {
  executionId: string;
  stepId: string;
  prefill: { title: string; stepsToReproduce: string; expectedResult: string; actualResult: string };
  onClose: () => void;
  onCreated: (execution: TestExecution) => void;
}) {
  const [title, setTitle] = useState(prefill.title);
  const [severity, setSeverity] = useState("");
  const [priority, setPriority] = useState("");
  const [environment, setEnvironment] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState(prefill.stepsToReproduce);
  const [expectedResult, setExpectedResult] = useState(prefill.expectedResult);
  const [actualResult, setActualResult] = useState(prefill.actualResult);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const execution = await api.post<TestExecution>(`/api/test-executions/${executionId}/steps/${stepId}/defects`, {
        title: title.trim(),
        severity: severity || null,
        priority: priority || null,
        environment: environment || null,
        stepsToReproduce: stepsToReproduce || null,
        expectedResult: expectedResult || null,
        actualResult: actualResult || null,
        description: description || null,
      });
      onCreated(execution);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the defect.");
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">Create Defect</h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
              <AlertCircle size={13} /> {error}
            </div>
          )}
          <div>
            <label className={LABEL_CLASS}>Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT_CLASS} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Severity</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={SELECT_CLASS}>
                <option value="">—</option>
                {DEFECT_SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={SELECT_CLASS}>
                <option value="">—</option>
                {WORK_ITEM_PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>Environment</label>
            <input value={environment} onChange={(e) => setEnvironment(e.target.value)} className={INPUT_CLASS} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Steps to Reproduce</label>
            <textarea value={stepsToReproduce} onChange={(e) => setStepsToReproduce(e.target.value)} rows={3} className={TEXTAREA_CLASS} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Expected Result</label>
              <textarea value={expectedResult} onChange={(e) => setExpectedResult(e.target.value)} rows={2} className={TEXTAREA_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Actual Result</label>
              <textarea value={actualResult} onChange={(e) => setActualResult(e.target.value)} rows={2} className={TEXTAREA_CLASS} />
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={TEXTAREA_CLASS} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800">
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm font-medium px-3 py-2">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !title.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            {saving ? "Creating…" : "Create Defect"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
