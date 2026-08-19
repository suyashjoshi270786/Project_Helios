import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useProject } from "../../projects/ProjectContext";
import {
  CARD_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  SELECT_CLASS,
  TEST_CASE_ENVIRONMENT_OPTIONS,
  TEST_CASE_PHASE_OPTIONS,
  TEST_CASE_TYPE_OPTIONS,
  TEXTAREA_CLASS,
  newId,
} from "./constants";
import type { TestCase, TestCaseType, TestStepDraft, TestSuite } from "./types";

function emptyStep(): TestStepDraft {
  return { key: newId(), description: "", testData: "", expectedResult: "" };
}

export default function TestCaseEditorPage() {
  const { suiteId, caseId } = useParams<{ suiteId?: string; caseId?: string }>();
  const { currentProjectId } = useProject();
  const navigate = useNavigate();
  const isEditing = !!caseId;

  const [suite, setSuite] = useState<TestSuite | null>(null);
  const [existing, setExisting] = useState<TestCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [preconditions, setPreconditions] = useState("");
  const [environment, setEnvironment] = useState("");
  const [testPhase, setTestPhase] = useState("");
  const [testType, setTestType] = useState<TestCaseType>("Manual");
  const [steps, setSteps] = useState<TestStepDraft[]>([emptyStep()]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        if (isEditing) {
          const tc = await api.get<TestCase>(`/api/test-cases/${caseId}`);
          setExisting(tc);
          setName(tc.name);
          setObjective(tc.objective ?? "");
          setPreconditions(tc.preconditions ?? "");
          setEnvironment(tc.environment ?? "");
          setTestPhase(tc.testPhase ?? "");
          setTestType(tc.testType);
          setSteps(
            tc.steps.length > 0
              ? tc.steps.map((s) => ({
                  key: s.id,
                  description: s.description,
                  testData: s.testData ?? "",
                  expectedResult: s.expectedResult,
                }))
              : [emptyStep()],
          );
          const suiteData = await api.get<TestSuite>(`/api/test-suites/${tc.testSuiteId}`);
          setSuite(suiteData);
        } else if (suiteId) {
          const suiteData = await api.get<TestSuite>(`/api/test-suites/${suiteId}`);
          setSuite(suiteData);
        }
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Could not load this test case.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [caseId, suiteId, isEditing]);

  function updateStep(key: string, partial: Partial<TestStepDraft>) {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...partial } : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, emptyStep()]);
  }

  function removeStep(key: string) {
    setSteps((prev) => (prev.length > 1 ? prev.filter((s) => s.key !== key) : prev));
  }

  function moveStep(index: number, direction: -1 | 1) {
    setSteps((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const validSteps = steps.filter((s) => s.description.trim() && s.expectedResult.trim());
  const canSave = name.trim().length > 0 && validSteps.length > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setSaveError("");
    try {
      const payload = {
        name: name.trim(),
        objective: objective || undefined,
        preconditions: preconditions || undefined,
        environment: environment || undefined,
        testPhase: testPhase || undefined,
        testType,
        steps: validSteps.map((s) => ({
          description: s.description.trim(),
          testData: s.testData || undefined,
          expectedResult: s.expectedResult.trim(),
        })),
      };

      if (isEditing && existing) {
        await api.patch<TestCase>(`/api/test-cases/${existing.id}`, payload);
        navigate(`/test-cases/suite/${existing.testSuiteId}`);
      } else {
        const created = await api.post<TestCase>("/api/test-cases", {
          ...payload,
          testSuiteId: suiteId,
          projectId: currentProjectId,
        });
        navigate(`/test-cases/suite/${created.testSuiteId}`);
      }
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not save this test case.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveToggle() {
    if (!existing) return;
    setArchiving(true);
    try {
      const updated = await api.patch<TestCase>(`/api/test-cases/${existing.id}`, { archived: !existing.archived });
      setExisting(updated);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not update this test case.");
    } finally {
      setArchiving(false);
    }
  }

  async function handleDelete() {
    if (!existing) return;
    setDeleting(true);
    try {
      await api.delete(`/api/test-cases/${existing.id}`);
      navigate(suite ? `/test-cases/suite/${suite.id}` : "/test-cases");
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not delete this test case.");
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">Loading…</div>;
  }
  if (loadError) {
    return <div className="p-8 text-center text-sm text-red-500 dark:text-red-400">{loadError}</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-1">
          Test Cases{suite ? ` / ${suite.name}` : ""}
        </p>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isEditing ? existing?.code : "New Test Case"}
          </h1>
          <div className="flex items-center gap-2">
            {isEditing && existing && (
              <>
                <button
                  onClick={handleArchiveToggle}
                  disabled={archiving}
                  className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-medium rounded-lg px-3.5 py-2 disabled:opacity-50"
                >
                  {existing.archived ? "Unarchive" : "Archive"}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 text-red-500 hover:text-red-400 text-xs font-medium rounded-lg px-3.5 py-2 disabled:opacity-50"
                >
                  {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Delete
                </button>
              </>
            )}
            <button
              onClick={() => navigate(suite ? `/test-cases/suite/${suite.id}` : "/test-cases")}
              className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-medium rounded-lg px-3.5 py-2"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !canSave}
              title={!canSave ? "Name and at least one complete step are required." : undefined}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save Test Case
            </button>
          </div>
        </div>
        {saveError && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{saveError}</p>}
      </div>

      <div className={CARD_CLASS + " space-y-4"}>
        <h2 className="text-sm font-medium text-slate-900 dark:text-white">Basic Information</h2>
        <div>
          <label className={LABEL_CLASS}>Test Case Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Successful Domestic Payment" className={INPUT_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Test Objective</label>
          <textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={2} className={TEXTAREA_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Preconditions</label>
          <textarea value={preconditions} onChange={(e) => setPreconditions(e.target.value)} rows={2} className={TEXTAREA_CLASS} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={LABEL_CLASS}>Test Environment</label>
            <select value={environment} onChange={(e) => setEnvironment(e.target.value)} className={SELECT_CLASS}>
              <option value="">—</option>
              {TEST_CASE_ENVIRONMENT_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Test Phase</label>
            <select value={testPhase} onChange={(e) => setTestPhase(e.target.value)} className={SELECT_CLASS}>
              <option value="">—</option>
              {TEST_CASE_PHASE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Test Type</label>
            <select value={testType} onChange={(e) => setTestType(e.target.value as TestCaseType)} className={SELECT_CLASS}>
              {TEST_CASE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={CARD_CLASS + " space-y-3"}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">Test Steps</h2>
          <button onClick={addStep} className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-400">
            <Plus size={13} /> Add Step
          </button>
        </div>
        {steps.map((step, i) => (
          <div key={step.key} className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Step {i + 1}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-blue-400 disabled:opacity-30 p-1">
                  <ArrowUp size={13} />
                </button>
                <button
                  onClick={() => moveStep(i, 1)}
                  disabled={i === steps.length - 1}
                  className="text-slate-400 hover:text-blue-400 disabled:opacity-30 p-1"
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  onClick={() => removeStep(step.key)}
                  disabled={steps.length === 1}
                  className="text-slate-400 hover:text-red-400 disabled:opacity-30 p-1"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <div>
              <label className={LABEL_CLASS}>Test Description *</label>
              <textarea
                value={step.description}
                onChange={(e) => updateStep(step.key, { description: e.target.value })}
                rows={2}
                className={TEXTAREA_CLASS}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>Test Data</label>
                <input
                  value={step.testData}
                  onChange={(e) => updateStep(step.key, { testData: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Expected Result *</label>
                <input
                  value={step.expectedResult}
                  onChange={(e) => updateStep(step.key, { expectedResult: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
