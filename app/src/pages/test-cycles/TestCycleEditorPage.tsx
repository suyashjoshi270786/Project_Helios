import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useProject } from "../../projects/ProjectContext";
import {
  CARD_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  SELECT_CLASS,
  TEXTAREA_CLASS,
  TEST_CASE_ENVIRONMENT_OPTIONS,
  TEST_CASE_PHASE_OPTIONS,
  openDatePicker,
} from "./constants";
import type { TestCycle } from "./types";

export default function TestCycleEditorPage() {
  const { currentProjectId } = useProject();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [testPhase, setTestPhase] = useState("");
  const [environment, setEnvironment] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [owner, setOwner] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const cycle = await api.post<TestCycle>("/api/test-cycles", {
        projectId: currentProjectId,
        name,
        testPhase,
        environment: environment || null,
        description: description || null,
        startDate: startDate || null,
        endDate: endDate || null,
        owner: owner || null,
      });
      navigate(`/test-cycles/${cycle.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the test cycle.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Create Test Cycle</h1>

      <form onSubmit={handleSubmit} className={CARD_CLASS + " space-y-4"}>
        <div>
          <label className={LABEL_CLASS}>Test Cycle Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="SIT Regression Aug 2026"
            className={INPUT_CLASS}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLASS}>Test Phase *</label>
            <select value={testPhase} onChange={(e) => setTestPhase(e.target.value)} className={SELECT_CLASS}>
              <option value="">Select a test phase…</option>
              {TEST_CASE_PHASE_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Environment</label>
            <select value={environment} onChange={(e) => setEnvironment(e.target.value)} className={SELECT_CLASS}>
              <option value="">Select an environment…</option>
              {TEST_CASE_ENVIRONMENT_OPTIONS.map((env) => (
                <option key={env} value={env}>
                  {env}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLASS}>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              onClick={openDatePicker}
              onFocus={openDatePicker}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              onClick={openDatePicker}
              onFocus={openDatePicker}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS}>Owner</label>
          <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Test cycle owner" className={INPUT_CLASS} />
        </div>

        <div>
          <label className={LABEL_CLASS}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What is this cycle covering?"
            className={TEXTAREA_CLASS}
          />
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate("/test-cycles")}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm font-medium px-3 py-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim() || !testPhase.trim()}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            {submitting ? "Saving…" : "Save & Continue"} <ArrowRight size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}
