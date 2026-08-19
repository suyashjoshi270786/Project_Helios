import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, ChevronRight, Copy, Loader2, Lock, Save, Sparkles } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import type { TestPlan, TestPlanDraft } from "./types";
import { DEFAULT_ENTRY_CRITERIA, DEFAULT_EXIT_CRITERIA, getValidationIssues } from "./constants";
import SourceRequirementsPanel from "./components/SourceRequirementsPanel";
import SummaryPanel from "./components/SummaryPanel";
import TestPlanDetailsStep from "./steps/TestPlanDetailsStep";
import TestTypesStep from "./steps/TestTypesStep";
import ScopeStrategyStep from "./steps/ScopeStrategyStep";
import EntryExitCriteriaStep from "./steps/EntryExitCriteriaStep";
import ResourcesScheduleStep from "./steps/ResourcesScheduleStep";
import ReviewGenerateStep from "./steps/ReviewGenerateStep";

const STEPS = [
  "Test Plan Details",
  "Test Types",
  "Scope & Strategy",
  "Entry & Exit Criteria",
  "Resources & Schedule",
  "Review & Generate",
];

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  UNDER_REVIEW: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  GENERATING: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  GENERATED: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  APPROVED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  REJECTED: "bg-red-500/15 text-red-400 border-red-500/30",
  SUPERSEDED: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

function toDraft(plan: TestPlan): TestPlanDraft {
  const {
    id: _id,
    planCode: _planCode,
    version: _version,
    isLatest: _isLatest,
    status: _status,
    projectId: _projectId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...rest
  } = plan;
  return {
    ...rest,
    entryCriteria: rest.entryCriteria && rest.entryCriteria.length > 0 ? rest.entryCriteria : DEFAULT_ENTRY_CRITERIA,
    exitCriteria: rest.exitCriteria && rest.exitCriteria.length > 0 ? rest.exitCriteria : DEFAULT_EXIT_CRITERIA,
  };
}

export default function TestPlanEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<TestPlan | null>(null);
  const [draft, setDraft] = useState<TestPlanDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [generationOptions, setGenerationOptions] = useState({ provider: "gemini", documentFormats: ["docx", "pdf"] });
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [downloadingFormat, setDownloadingFormat] = useState<"docx" | "pdf" | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState("");
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [versionError, setVersionError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get<TestPlan>(`/api/test-plans/${id}`)
      .then((data) => {
        setPlan(data);
        setDraft(toDraft(data));
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Could not load this test plan."))
      .finally(() => setLoading(false));
  }, [id]);

  function handleChange(partial: Partial<TestPlanDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
  }

  function handleClear() {
    if (!plan) return;
    setDraft({
      name: "",
      testPhase: "",
      releaseVersion: "",
      environment: "",
      priority: "Medium",
      owner: "",
      plannedStartDate: null,
      plannedEndDate: null,
      objective: "",
      testTypes: [],
      otherTestType: "",
      inScope: [],
      outOfScope: [],
      testStrategy: {},
      testDataStrategy: {},
      environmentConfig: {},
      entryCriteria: DEFAULT_ENTRY_CRITERIA,
      exitCriteria: DEFAULT_EXIT_CRITERIA,
      risks: [],
      dependencies: [],
      resources: [],
      schedule: {},
      selectedRequirementIds: draft?.selectedRequirementIds ?? [],
    });
  }

  async function persistDraft(): Promise<TestPlan> {
    if (!id || !draft) throw new Error("Nothing to save.");
    const { selectedRequirementIds, requirements: _requirements, requirementCount: _requirementCount, ...fields } = draft;
    const updated = await api.patch<TestPlan>(`/api/test-plans/${id}`, {
      ...fields,
      requirementIds: selectedRequirementIds,
    });
    setPlan(updated);
    setDraft(toDraft(updated));
    return updated;
  }

  async function handleSaveDraft() {
    setSaving(true);
    setSaveError("");
    try {
      await persistDraft();
      setSavedAt(new Date());
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    if (!id) return;
    setGenerating(true);
    setGenerateError("");
    try {
      await persistDraft();
      const updated = await api.post<TestPlan>(
        `/api/test-plans/${id}/generate`,
        { provider: generationOptions.provider, documentFormats: generationOptions.documentFormats },
        60000,
      );
      setPlan(updated);
      setDraft(toDraft(updated));
    } catch (err) {
      setGenerateError(err instanceof ApiError ? err.message : "Test Plan generation failed. Try again shortly.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload(format: "docx" | "pdf") {
    if (!id) return;
    setDownloadingFormat(format);
    try {
      const base = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
      const res = await fetch(`${base}/api/test-plans/${id}/document?format=${format}`, { credentials: "include" });
      if (!res.ok) throw new Error("Could not download the document.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${plan?.planCode ?? "test-plan"}-v${plan?.version ?? "1.0"}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setGenerateError("Could not download the document.");
    } finally {
      setDownloadingFormat(null);
    }
  }

  async function handleApprove() {
    if (!id) return;
    setApproving(true);
    setApproveError("");
    try {
      const updated = await api.post<TestPlan>(`/api/test-plans/${id}/approve`);
      setPlan(updated);
      setDraft(toDraft(updated));
    } catch (err) {
      setApproveError(err instanceof ApiError ? err.message : "Could not approve this test plan.");
    } finally {
      setApproving(false);
    }
  }

  async function handleReject(reason: string) {
    if (!id) return;
    setRejecting(true);
    setRejectError("");
    try {
      const updated = await api.post<TestPlan>(`/api/test-plans/${id}/reject`, { reason });
      setPlan(updated);
      setDraft(toDraft(updated));
    } catch (err) {
      setRejectError(err instanceof ApiError ? err.message : "Could not reject this test plan.");
    } finally {
      setRejecting(false);
    }
  }

  async function handleNewVersion() {
    if (!id) return;
    setCreatingVersion(true);
    setVersionError("");
    try {
      const created = await api.post<TestPlan>(`/api/test-plans/${id}/new-version`);
      navigate(`/test-planning/${created.id}`);
    } catch (err) {
      setVersionError(err instanceof ApiError ? err.message : "Could not create a new version.");
    } finally {
      setCreatingVersion(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">Loading…</div>;
  }
  if (loadError || !plan || !draft) {
    return <div className="p-8 text-center text-sm text-red-500 dark:text-red-400">{loadError || "Not found."}</div>;
  }

  const issues = getValidationIssues(draft);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
        <span className="inline-flex items-center gap-1 text-emerald-500">
          <CheckCircle2 size={13} /> Requirements
        </span>
        <ChevronRight size={12} />
        <span className="inline-flex items-center gap-1 text-blue-500 font-medium">● Test Planning</span>
        <ChevronRight size={12} />
        <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-600">
          <Lock size={11} /> Test Cases
        </span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              {draft.name?.trim() || "New Test Plan"}
            </h1>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_STYLES[plan.status]}`}>
              {plan.status.replace("_", " ")}
            </span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{plan.planCode} · v{plan.version}</p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && plan.status !== "APPROVED" && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Draft saved at {savedAt.toLocaleTimeString()}
            </span>
          )}
          {plan.status === "APPROVED" ? (
            <>
              <button
                onClick={handleNewVersion}
                disabled={creatingVersion}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
              >
                {creatingVersion ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                Create New Version
              </button>
              <button
                disabled
                title="Test Cases module isn't built yet."
                className="inline-flex items-center gap-1.5 bg-emerald-600 opacity-50 cursor-not-allowed text-white text-xs font-medium rounded-lg px-3.5 py-2"
              >
                Create Test Cases →
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-medium rounded-lg px-3.5 py-2"
              >
                Clear
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save Draft
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || issues.length > 0}
                title={issues.length > 0 ? "Complete the required fields first." : undefined}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
              >
                {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {generating ? "Generating…" : plan.generatedContent ? "Regenerate Test Plan" : "Generate Test Plan"}
              </button>
            </>
          )}
        </div>
      </div>
      {versionError && <p className="text-xs text-red-500 dark:text-red-400">{versionError}</p>}
      {saveError && <p className="text-xs text-red-500 dark:text-red-400">{saveError}</p>}

      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => setStep(i)}
            className={`shrink-0 flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 transition-colors ${
              i === step
                ? "bg-blue-600 text-white"
                : "bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-[10px]">
              {i + 1}
            </span>
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
        <div className="space-y-5">
          {step === 0 && <TestPlanDetailsStep draft={draft} onChange={handleChange} planCode={plan.planCode} />}
          {step === 1 && <TestTypesStep draft={draft} onChange={handleChange} />}
          {step === 2 && <ScopeStrategyStep draft={draft} onChange={handleChange} />}
          {step === 3 && <EntryExitCriteriaStep draft={draft} onChange={handleChange} />}
          {step === 4 && <ResourcesScheduleStep draft={draft} onChange={handleChange} />}
          {step === 5 && (
            <ReviewGenerateStep
              draft={draft}
              plan={plan}
              generationOptions={generationOptions}
              onGenerationOptionsChange={(partial) => setGenerationOptions((prev) => ({ ...prev, ...partial }))}
              generating={generating}
              generateError={generateError}
              onGenerate={handleGenerate}
              downloadingFormat={downloadingFormat}
              onDownload={handleDownload}
              approving={approving}
              approveError={approveError}
              onApprove={handleApprove}
              rejecting={rejecting}
              rejectError={rejectError}
              onReject={handleReject}
            />
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} /> Back
            </button>
            <button
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              disabled={step === STEPS.length - 1}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <SourceRequirementsPanel
            projectId={plan.projectId}
            selectedIds={draft.selectedRequirementIds}
            onChange={(ids) => handleChange({ selectedRequirementIds: ids })}
          />
          <SummaryPanel draft={draft} />
          {issues.length > 0 && step === STEPS.length - 1 && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {issues.length} item{issues.length === 1 ? "" : "s"} remaining before this plan can be generated.
            </p>
          )}
        </div>
      </div>

      <button
        onClick={() => navigate("/test-planning")}
        className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
      >
        ← Back to Test Plans
      </button>
    </div>
  );
}
