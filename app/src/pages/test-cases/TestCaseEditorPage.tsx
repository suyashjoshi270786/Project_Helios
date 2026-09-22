import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Bot, ClipboardList, FolderTree as FolderTreeIcon, Loader2, Plus, Save, Sparkles, Trash2, Workflow } from "lucide-react";
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
import { WORK_ITEM_TYPE_BADGE_CLASS } from "../work-items/constants";
import type { TestCase, TestCaseType, TestStepDraft, TestSuite } from "./types";

function emptyStep(): TestStepDraft {
  return { key: newId(), description: "", testData: "", expectedResult: "" };
}

const GHERKIN_TEMPLATE = `Feature:

  Scenario:
    Given
    When
    Then `;

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
  const [gherkinScript, setGherkinScript] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertNotice, setConvertNotice] = useState("");
  const [convertError, setConvertError] = useState("");

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
          setGherkinScript(tc.gherkinScript ?? "");
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
  const canSave =
    name.trim().length > 0 && (testType === "Manual" ? validSteps.length > 0 : gherkinScript.trim().length > 0);

  // Switching Test Type used to just seed an empty Gherkin template and
  // otherwise leave whatever was in the other format sitting there unused —
  // any manual steps or Gherkin already written had to be retyped by hand.
  // Now the moment the type changes, the current content is converted
  // through Gemini into the other representation (steps -> Gherkin or
  // Gherkin -> steps), so nothing already written is lost or needs redoing.
  async function handleTestTypeChange(next: TestCaseType) {
    if (next === testType) return;
    setTestType(next);
    setConvertNotice("");
    setConvertError("");

    if (next === "Automated") {
      const sourceSteps = validSteps.map((s) => ({
        description: s.description.trim(),
        testData: s.testData.trim() || undefined,
        expectedResult: s.expectedResult.trim(),
      }));
      if (sourceSteps.length === 0) {
        if (!gherkinScript.trim()) setGherkinScript(GHERKIN_TEMPLATE);
        return;
      }
      setConverting(true);
      try {
        const result = await api.post<{ gherkinScript: string }>(
          "/api/test-cases/convert",
          { direction: "stepsToGherkin", name: name.trim() || "Untitled test case", objective: objective || undefined, steps: sourceSteps },
          30000,
        );
        setGherkinScript(result.gherkinScript);
        setConvertNotice("Gherkin script generated from your manual steps — review before saving.");
      } catch (err) {
        setConvertError(err instanceof ApiError ? err.message : "Could not auto-generate the Gherkin script from your steps.");
        if (!gherkinScript.trim()) setGherkinScript(GHERKIN_TEMPLATE);
      } finally {
        setConverting(false);
      }
    } else {
      const sourceGherkin = gherkinScript.trim();
      if (!sourceGherkin || sourceGherkin === GHERKIN_TEMPLATE.trim()) return;
      setConverting(true);
      try {
        const result = await api.post<{ steps: { description: string; testData?: string; expectedResult: string }[] }>(
          "/api/test-cases/convert",
          { direction: "gherkinToSteps", name: name.trim() || "Untitled test case", objective: objective || undefined, gherkinScript: sourceGherkin },
          30000,
        );
        if (result.steps.length > 0) {
          setSteps(result.steps.map((s) => ({ key: newId(), description: s.description, testData: s.testData ?? "", expectedResult: s.expectedResult })));
          setConvertNotice("Manual steps generated from your Gherkin script — review before saving.");
        }
      } catch (err) {
        setConvertError(err instanceof ApiError ? err.message : "Could not auto-generate manual steps from your Gherkin script.");
      } finally {
        setConverting(false);
      }
    }
  }

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
        steps:
          testType === "Manual"
            ? validSteps.map((s) => ({
                description: s.description.trim(),
                testData: s.testData || undefined,
                expectedResult: s.expectedResult.trim(),
              }))
            : undefined,
        gherkinScript: testType === "Automated" ? gherkinScript.trim() : undefined,
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
              disabled={saving || converting || !canSave}
              title={
                !canSave
                  ? testType === "Manual"
                    ? "Name and at least one complete step are required."
                    : "Name and a Gherkin script are required."
                  : undefined
              }
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save Test Case
            </button>
          </div>
        </div>
        {saveError && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{saveError}</p>}
      </div>

      {isEditing && existing && (
        <div className={CARD_CLASS + " space-y-2.5"}>
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">Traceability</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div className="flex items-center gap-2">
              <FolderTreeIcon size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
              <span className="text-slate-400 dark:text-slate-500">Folder:</span>
              <span className="text-slate-700 dark:text-slate-300 truncate">
                {existing.testSuite ? `${existing.testSuite.folder.name} / ${existing.testSuite.name}` : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {existing.sourceRequirementId ? <Sparkles size={13} className="text-indigo-500 shrink-0" /> : <Bot size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />}
              <span className="text-slate-400 dark:text-slate-500">Source:</span>
              <span className="text-slate-700 dark:text-slate-300">
                {existing.sourceRequirementId ? "AI Generated" : "Manual"}
              </span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <ClipboardList size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
              <span className="text-slate-400 dark:text-slate-500 shrink-0">Requirement:</span>
              <span className="text-slate-700 dark:text-slate-300 truncate">
                {existing.sourceRequirement?.title ?? "—"}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <Workflow size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
              <span className="text-slate-400 dark:text-slate-500 shrink-0">Work Item:</span>
              {existing.workItems && existing.workItems.length > 0 ? (
                existing.workItems.map((wi) => (
                  <button
                    key={wi.id}
                    onClick={() => navigate(`/work-items/${wi.id}`)}
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full hover:underline ${WORK_ITEM_TYPE_BADGE_CLASS[wi.type as keyof typeof WORK_ITEM_TYPE_BADGE_CLASS] ?? "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}
                  >
                    {wi.key}
                  </button>
                ))
              ) : (
                <span className="text-slate-700 dark:text-slate-300">—</span>
              )}
            </div>
            <div className="text-slate-400 dark:text-slate-500">
              Created <span className="text-slate-700 dark:text-slate-300">{new Date(existing.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="text-slate-400 dark:text-slate-500">
              Updated <span className="text-slate-700 dark:text-slate-300">{new Date(existing.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}

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
            <select
              value={testType}
              onChange={(e) => handleTestTypeChange(e.target.value as TestCaseType)}
              disabled={converting}
              className={SELECT_CLASS}
            >
              {TEST_CASE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {converting && (
          <p className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400">
            <Loader2 size={12} className="animate-spin" />
            {testType === "Automated" ? "Generating a Gherkin script from your steps…" : "Generating manual steps from your Gherkin script…"}
          </p>
        )}
        {convertNotice && !converting && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <Sparkles size={12} /> {convertNotice}
          </p>
        )}
        {convertError && !converting && <p className="text-xs text-red-500 dark:text-red-400">{convertError}</p>}
      </div>

      {testType === "Automated" ? (
        <div className={CARD_CLASS + " space-y-2"}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-900 dark:text-white">Gherkin Script</h2>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">Cucumber-style Given / When / Then</span>
          </div>
          <textarea
            value={gherkinScript}
            onChange={(e) => setGherkinScript(e.target.value)}
            rows={12}
            spellCheck={false}
            placeholder={GHERKIN_TEMPLATE}
            className={TEXTAREA_CLASS + " font-mono text-xs leading-relaxed"}
          />
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Automation frameworks can pull this test case by its code ({existing?.code ?? "assigned on save"}) via
            the API — see Settings → Integrations.
          </p>
        </div>
      ) : (
      <div className={CARD_CLASS + " space-y-3"}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">Test Steps</h2>
          <button onClick={addStep} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500">
            <Plus size={13} /> Add Step
          </button>
        </div>
        {steps.map((step, i) => (
          <div key={step.key} className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Step {i + 1}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-indigo-500 disabled:opacity-30 p-1">
                  <ArrowUp size={13} />
                </button>
                <button
                  onClick={() => moveStep(i, 1)}
                  disabled={i === steps.length - 1}
                  className="text-slate-400 hover:text-indigo-500 disabled:opacity-30 p-1"
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
      )}
    </div>
  );
}
