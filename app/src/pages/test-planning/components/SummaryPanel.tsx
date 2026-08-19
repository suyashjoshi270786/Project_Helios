import type { TestPlanDraft } from "../types";
import { CARD_CLASS } from "../constants";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-400 dark:text-slate-500">{label}</span>
      <span className="text-slate-700 dark:text-slate-200 font-medium text-right">{value}</span>
    </div>
  );
}

function plannedDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return "—";
  const startDate = new Date(start);
  const endDate = new Date(end);
  const days = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return days > 0 ? `${days} day${days === 1 ? "" : "s"}` : "—";
}

export default function SummaryPanel({ draft }: { draft: TestPlanDraft }) {
  return (
    <div className={CARD_CLASS + " space-y-2.5 sticky top-4"}>
      <h2 className="text-sm font-medium text-slate-900 dark:text-white mb-1">Test Plan Summary</h2>
      <Row label="Requirements" value={`${draft.selectedRequirementIds.length} selected`} />
      <Row label="Test Phase" value={draft.testPhase || "—"} />
      <Row label="Environment" value={draft.environment || "—"} />
      <Row label="Test Types" value={`${draft.testTypes?.length ?? 0} selected`} />
      <Row label="In Scope" value={`${draft.inScope?.length ?? 0} areas`} />
      <Row label="Out of Scope" value={`${draft.outOfScope?.length ?? 0} areas`} />
      <Row label="Planned Duration" value={plannedDuration(draft.plannedStartDate, draft.plannedEndDate)} />
      <Row label="Owner" value={draft.owner || "—"} />
      <Row label="Priority" value={draft.priority || "—"} />
    </div>
  );
}
