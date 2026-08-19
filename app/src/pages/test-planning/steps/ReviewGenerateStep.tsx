import { useState } from "react";
import { CheckCircle2, CircleAlert, Download, Loader2, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import type { TestPlan, TestPlanDraft } from "../types";
import { CARD_CLASS, getValidationIssues, SELECT_CLASS, TEXTAREA_CLASS } from "../constants";

type GenerationOptions = { provider: string; documentFormats: string[] };

type Props = {
  draft: TestPlanDraft;
  plan: TestPlan;
  generationOptions: GenerationOptions;
  onGenerationOptionsChange: (partial: Partial<GenerationOptions>) => void;
  generating: boolean;
  generateError: string;
  onGenerate: () => void;
  downloadingFormat: "docx" | "pdf" | null;
  onDownload: (format: "docx" | "pdf") => void;
  approving: boolean;
  approveError: string;
  onApprove: () => void;
  rejecting: boolean;
  rejectError: string;
  onReject: (reason: string) => void;
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-slate-400 dark:text-slate-500">{label}</div>
      <div className="text-sm text-slate-800 dark:text-slate-200">{value || "—"}</div>
    </div>
  );
}

const SECTION_LABELS: Record<string, string> = {
  documentControl: "Document Control",
  overview: "Overview",
  scope: "Scope",
  testStrategy: "Test Strategy",
  testEnvironment: "Test Environment",
  testDataStrategy: "Test Data Strategy",
  entryExitCriteria: "Entry & Exit Criteria",
  deliverables: "Test Deliverables",
  resourcesResponsibilities: "Resources & Responsibilities",
  schedule: "Schedule",
  dependencies: "Dependencies",
  risksMitigations: "Risks & Mitigations",
  defectManagement: "Defect Management Approach",
  executionApproach: "Test Execution Approach",
};

export default function ReviewGenerateStep({
  draft,
  plan,
  generationOptions,
  onGenerationOptionsChange,
  generating,
  generateError,
  onGenerate,
  downloadingFormat,
  onDownload,
  approving,
  approveError,
  onApprove,
  rejecting,
  rejectError,
  onReject,
}: Props) {
  const issues = getValidationIssues(draft);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const canEdit = plan.status !== "APPROVED" && plan.status !== "SUPERSEDED";
  const hasGenerated = !!plan.generatedContent;
  const canReview = plan.status === "GENERATED";

  function toggleFormat(format: string) {
    const current = generationOptions.documentFormats;
    onGenerationOptionsChange({
      documentFormats: current.includes(format) ? current.filter((f) => f !== format) : [...current, format],
    });
  }

  return (
    <div className="space-y-5">
      <div className={CARD_CLASS + " space-y-3"}>
        <h2 className="text-sm font-medium text-slate-900 dark:text-white">6. Review &amp; Generate</h2>

        {issues.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={14} /> This test plan is ready to generate.
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <CircleAlert size={14} /> Complete the following before generating:
            </div>
            <ul className="list-disc list-inside text-xs text-slate-500 dark:text-slate-400 space-y-0.5 pl-1">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {canEdit && (
        <div className={CARD_CLASS + " space-y-3"}>
          <h3 className="text-sm font-medium text-slate-900 dark:text-white">Generation Options</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">AI Model</label>
              <select
                value={generationOptions.provider}
                onChange={(e) => onGenerationOptionsChange({ provider: e.target.value })}
                className={SELECT_CLASS}
              >
                <option value="gemini">Google Gemini</option>
                <option value="anthropic">Claude (Anthropic)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Document Formats</label>
              <div className="flex items-center gap-4 h-[38px]">
                {["docx", "pdf"].map((format) => (
                  <label key={format} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={generationOptions.documentFormats.includes(format)}
                      onChange={() => toggleFormat(format)}
                    />
                    {format.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {generateError && <p className="text-xs text-red-500 dark:text-red-400">{generateError}</p>}

          <button
            onClick={onGenerate}
            disabled={generating || issues.length > 0}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
          >
            {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {generating ? "Generating…" : hasGenerated ? "Regenerate Test Plan" : "Generate Test Plan"}
          </button>
        </div>
      )}

      {hasGenerated && plan.generatedContent && (
        <div className={CARD_CLASS + " space-y-3"}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-900 dark:text-white">Generated Test Plan</h3>
            <div className="flex items-center gap-2">
              {plan.documentFormats.includes("docx") && (
                <button
                  onClick={() => onDownload("docx")}
                  disabled={downloadingFormat !== null}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-500 hover:text-blue-400 disabled:opacity-50"
                >
                  {downloadingFormat === "docx" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  DOCX
                </button>
              )}
              {plan.documentFormats.includes("pdf") && (
                <button
                  onClick={() => onDownload("pdf")}
                  disabled={downloadingFormat !== null}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-500 hover:text-blue-400 disabled:opacity-50"
                >
                  {downloadingFormat === "pdf" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  PDF
                </button>
              )}
            </div>
          </div>

          {plan.generatedContent.assumptionsAndClarifications.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Recommended clarifications</p>
              <ul className="list-disc list-inside text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                {plan.generatedContent.assumptionsAndClarifications.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {Object.entries(plan.generatedContent.sections).map(([key, text]) => (
              <Field key={key} label={SECTION_LABELS[key] ?? key} value={text} />
            ))}
          </div>

          {canReview && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
              {approveError && <p className="text-xs text-red-500 dark:text-red-400">{approveError}</p>}
              {rejectError && <p className="text-xs text-red-500 dark:text-red-400">{rejectError}</p>}
              <div className="flex items-center gap-2">
                <button
                  onClick={onApprove}
                  disabled={approving || rejecting}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
                >
                  {approving ? <Loader2 size={13} className="animate-spin" /> : <ThumbsUp size={13} />}
                  Approve Test Plan
                </button>
                <button
                  onClick={() => setShowRejectForm((v) => !v)}
                  disabled={approving || rejecting}
                  className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-red-500 disabled:opacity-50 text-xs font-medium rounded-lg px-3.5 py-2"
                >
                  <ThumbsDown size={13} /> Reject
                </button>
              </div>
              {showRejectForm && (
                <div className="space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection…"
                    rows={2}
                    className={TEXTAREA_CLASS}
                  />
                  <button
                    onClick={() => onReject(rejectReason)}
                    disabled={rejecting || !rejectReason.trim()}
                    className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
                  >
                    {rejecting ? <Loader2 size={13} className="animate-spin" /> : <ThumbsDown size={13} />}
                    Confirm Rejection
                  </button>
                </div>
              )}
            </div>
          )}

          {plan.status === "REJECTED" && plan.rejectedReason && (
            <p className="text-xs text-red-500 dark:text-red-400 pt-2 border-t border-slate-200 dark:border-slate-800">
              Rejected: {plan.rejectedReason} — edit any field to move this plan back to Draft.
            </p>
          )}

          {plan.status === "APPROVED" && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 pt-2 border-t border-slate-200 dark:border-slate-800">
              ✓ Test Plan Approved{plan.approvedAt ? ` on ${new Date(plan.approvedAt).toLocaleDateString()}` : ""}.
            </p>
          )}
        </div>
      )}

      <div className={CARD_CLASS + " space-y-3"}>
        <h3 className="text-sm font-medium text-slate-900 dark:text-white">Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Test Plan Name" value={draft.name ?? ""} />
          <Field label="Release / Version" value={draft.releaseVersion ?? ""} />
          <Field label="Test Phase" value={draft.testPhase ?? ""} />
          <Field label="Environment" value={draft.environment ?? ""} />
          <Field label="Priority" value={draft.priority ?? ""} />
          <Field label="Owner" value={draft.owner ?? ""} />
        </div>
        <Field label="Objective" value={draft.objective ?? ""} />
        <Field label="Test Types" value={(draft.testTypes ?? []).join(", ")} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="In Scope" value={(draft.inScope ?? []).join(", ")} />
          <Field label="Out of Scope" value={(draft.outOfScope ?? []).join(", ")} />
        </div>
      </div>
    </div>
  );
}
