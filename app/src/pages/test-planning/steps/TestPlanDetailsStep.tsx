import type { TestPlanDraft } from "../types";
import { CARD_CLASS, ENVIRONMENT_OPTIONS, INPUT_CLASS, LABEL_CLASS, openDatePicker, PRIORITY_OPTIONS, SELECT_CLASS, TEST_PHASE_OPTIONS, TEXTAREA_CLASS } from "../constants";
import SuggestButton from "../components/SuggestButton";

type Props = {
  draft: TestPlanDraft;
  onChange: (partial: Partial<TestPlanDraft>) => void;
  planCode: string;
};

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export default function TestPlanDetailsStep({ draft, onChange, planCode }: Props) {
  return (
    <div className={CARD_CLASS + " space-y-4"}>
      <h2 className="text-sm font-medium text-slate-900 dark:text-white">1. Test Plan Details</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASS}>Test Plan Name *</label>
          <input
            value={draft.name ?? ""}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Customer Portal - System Integration Testing"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Plan ID</label>
          <input value={planCode} disabled className={INPUT_CLASS + " opacity-60"} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Release / Version *</label>
          <input
            value={draft.releaseVersion ?? ""}
            onChange={(e) => onChange({ releaseVersion: e.target.value })}
            placeholder="Release 5.4"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Test Phase *</label>
          <select
            value={draft.testPhase ?? ""}
            onChange={(e) => onChange({ testPhase: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">Select a test phase…</option>
            {TEST_PHASE_OPTIONS.map((phase) => (
              <option key={phase} value={phase}>
                {phase}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Environment *</label>
          <select
            value={draft.environment ?? ""}
            onChange={(e) => onChange({ environment: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">Select an environment…</option>
            {ENVIRONMENT_OPTIONS.map((env) => (
              <option key={env} value={env}>
                {env}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Priority *</label>
          <select
            value={draft.priority ?? ""}
            onChange={(e) => onChange({ priority: e.target.value as TestPlanDraft["priority"] })}
            className={SELECT_CLASS}
          >
            <option value="">Select priority…</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Owner *</label>
          <input
            value={draft.owner ?? ""}
            onChange={(e) => onChange({ owner: e.target.value })}
            placeholder="Test Plan owner"
            className={INPUT_CLASS}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={LABEL_CLASS}>Planned Start Date</label>
            <input
              type="date"
              value={toDateInputValue(draft.plannedStartDate)}
              onChange={(e) => onChange({ plannedStartDate: e.target.value || null })}
              onClick={openDatePicker}
              onFocus={openDatePicker}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Planned End Date</label>
            <input
              type="date"
              value={toDateInputValue(draft.plannedEndDate)}
              onChange={(e) => onChange({ plannedEndDate: e.target.value || null })}
              onClick={openDatePicker}
              onFocus={openDatePicker}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className={LABEL_CLASS}>Objective *</label>
          <SuggestButton
            field="objective"
            context={{
              testPlanName: draft.name,
              testPhase: draft.testPhase,
              releaseVersion: draft.releaseVersion,
              environment: draft.environment,
              testTypes: draft.testTypes,
              inScope: draft.inScope,
            }}
            onSuggest={(text) => onChange({ objective: text })}
          />
        </div>
        <textarea
          value={draft.objective ?? ""}
          onChange={(e) => onChange({ objective: e.target.value })}
          rows={4}
          placeholder="To validate the integration between the Customer Portal and backend services…"
          className={TEXTAREA_CLASS}
        />
      </div>
    </div>
  );
}
