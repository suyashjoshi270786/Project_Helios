import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, Bug, Loader2, Paperclip } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import {
  CARD_CLASS,
  TEXTAREA_CLASS,
  LABEL_CLASS,
  EXECUTION_STATUS_ORDER,
  EXECUTION_STATUS_LABELS,
  EXECUTION_STATUS_BADGE_CLASS,
  EXECUTION_STATUS_BUTTON_CLASS,
} from "./constants";
import type { ExecutionStatus, TestCycleTestExecutionDetail, TestExecution, TestStepExecution } from "./types";

function StatusButtons({
  current,
  onPick,
  disabled,
}: {
  current: ExecutionStatus;
  onPick: (status: ExecutionStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {EXECUTION_STATUS_ORDER.map((status) => (
        <button
          key={status}
          type="button"
          disabled={disabled}
          onClick={() => onPick(status)}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
            current === status
              ? EXECUTION_STATUS_BUTTON_CLASS[status]
              : "border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          {EXECUTION_STATUS_LABELS[status]}
        </button>
      ))}
    </div>
  );
}

function StepCard({
  step,
  onUpdate,
}: {
  step: TestStepExecution;
  onUpdate: (stepId: string, fields: Partial<Pick<TestStepExecution, "status" | "actualResult" | "comment">>) => void;
}) {
  const [actualResult, setActualResult] = useState(step.actualResult ?? "");
  const [comment, setComment] = useState(step.comment ?? "");
  const [attachmentName, setAttachmentName] = useState<string | null>(null);

  return (
    <div className={CARD_CLASS + " space-y-3"}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Step {step.stepNumber}</span>
        <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${EXECUTION_STATUS_BADGE_CLASS[step.status]}`}>
          {EXECUTION_STATUS_LABELS[step.status]}
        </span>
      </div>

      <div>
        <div className={LABEL_CLASS}>Test Description</div>
        <p className="text-sm text-slate-800 dark:text-slate-200">{step.description}</p>
      </div>
      {step.testData && (
        <div>
          <div className={LABEL_CLASS}>Test Data</div>
          <p className="text-sm text-slate-600 dark:text-slate-400">{step.testData}</p>
        </div>
      )}
      <div>
        <div className={LABEL_CLASS}>Expected Result</div>
        <p className="text-sm text-slate-800 dark:text-slate-200">{step.expectedResult}</p>
      </div>

      <StatusButtons current={step.status} onPick={(status) => onUpdate(step.id, { status })} />

      {step.status === "Fail" && (
        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Actual Result</label>
              <textarea
                value={actualResult}
                onChange={(e) => setActualResult(e.target.value)}
                onBlur={() => onUpdate(step.id, { actualResult })}
                rows={2}
                placeholder="What actually happened?"
                className={TEXTAREA_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Comment</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onBlur={() => onUpdate(step.id, { comment })}
                rows={2}
                placeholder="Notes for whoever investigates this failure…"
                className={TEXTAREA_CLASS}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Evidence</label>
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 cursor-pointer w-full">
                <Paperclip size={13} className="shrink-0" />
                <span className="truncate">{attachmentName ?? "Attach a file (.doc, .docx, .pdf)"}</span>
                <input
                  type="file"
                  accept=".doc,.docx,.pdf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => setAttachmentName(e.target.files?.[0]?.name ?? null)}
                />
              </label>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Selected for reference only — attachments aren't uploaded yet.
              </p>
            </div>
            <div>
              <label className={LABEL_CLASS}>Defect</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  title="Available once the Defect module is built"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 cursor-not-allowed opacity-60"
                >
                  <Bug size={13} /> Create Defect
                </button>
                <button
                  type="button"
                  disabled
                  title="Available once the Defect module is built"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 cursor-not-allowed opacity-60"
                >
                  Link Existing Defect
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TestCycleExecutionPage() {
  const { cycleId, cycleTestId } = useParams<{ cycleId: string; cycleTestId: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<TestCycleTestExecutionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (cycleId && cycleTestId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId, cycleTestId]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<TestCycleTestExecutionDetail>(`/api/test-cycles/${cycleId}/tests/${cycleTestId}`);
      setDetail(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this test execution.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOverallStatus(status: ExecutionStatus) {
    if (!detail) return;
    try {
      const execution = await api.patch<TestExecution>(`/api/test-executions/${detail.execution.id}`, { status });
      setDetail((prev) => (prev ? { ...prev, execution } : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the test case status.");
    }
  }

  async function handleStepUpdate(
    stepId: string,
    fields: Partial<Pick<TestStepExecution, "status" | "actualResult" | "comment">>,
  ) {
    if (!detail) return;
    try {
      const execution = await api.patch<TestExecution>(
        `/api/test-executions/${detail.execution.id}/steps/${stepId}`,
        fields,
      );
      setDetail((prev) => (prev ? { ...prev, execution } : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update that step.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-10 justify-center">
        <Loader2 size={14} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
        <button onClick={() => navigate(`/test-cycles/${cycleId}`)} className="text-sm text-blue-500 hover:underline">
          Back to Test Cycle
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <button
          onClick={() => navigate(`/test-cycles/${cycleId}`)}
          className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-400 hover:underline mb-1"
        >
          {detail.testCycle.name}
        </button>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
          {detail.testCase.code} {detail.testCase.name}
        </h1>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          Tester: {detail.tester || "—"} · Environment: {detail.environment || "—"}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      <div className={CARD_CLASS + " flex items-center justify-between flex-wrap gap-3"}>
        <div>
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">Test Case Status</div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Derived automatically from step results — or set it directly here.
          </p>
        </div>
        <StatusButtons current={detail.execution.status} onPick={handleOverallStatus} />
      </div>

      <div className="space-y-3">
        {detail.execution.steps.length === 0 ? (
          <div className={CARD_CLASS + " text-center text-sm text-slate-400 dark:text-slate-500"}>
            This test case has no steps.
          </div>
        ) : (
          detail.execution.steps.map((step) => <StepCard key={step.id} step={step} onUpdate={handleStepUpdate} />)
        )}
      </div>
    </div>
  );
}
