import type { TestPlanDraft } from "../types";
import { CARD_CLASS, INPUT_CLASS, LABEL_CLASS, TEST_PHASE_RECOMMENDATIONS, TEST_TYPE_OPTIONS } from "../constants";

type Props = { draft: TestPlanDraft; onChange: (partial: Partial<TestPlanDraft>) => void };

export default function TestTypesStep({ draft, onChange }: Props) {
  const testTypes = draft.testTypes ?? [];
  const recommended = draft.testPhase ? TEST_PHASE_RECOMMENDATIONS[draft.testPhase] : undefined;
  const missingRecommended = recommended?.filter((t) => !testTypes.includes(t)) ?? [];

  function toggle(type: string) {
    onChange({
      testTypes: testTypes.includes(type) ? testTypes.filter((t) => t !== type) : [...testTypes, type],
    });
  }

  function addRecommended() {
    onChange({ testTypes: [...testTypes, ...missingRecommended] });
  }

  return (
    <div className={CARD_CLASS + " space-y-4"}>
      <div>
        <h2 className="text-sm font-medium text-slate-900 dark:text-white">2. Test Types</h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          Select the types of testing to be included in this plan.
        </p>
      </div>

      {recommended && missingRecommended.length > 0 && (
        <div className="flex items-center justify-between gap-3 bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2">
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Recommended for {draft.testPhase}: {recommended.join(", ")}
          </p>
          <button onClick={addRecommended} className="text-xs font-medium text-blue-500 hover:text-blue-400 shrink-0">
            Add recommended
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {TEST_TYPE_OPTIONS.map((type) => (
          <label
            key={type}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer transition-colors ${
              testTypes.includes(type)
                ? "border-blue-600/50 bg-blue-500/5 text-slate-800 dark:text-slate-100"
                : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
            }`}
          >
            <input type="checkbox" checked={testTypes.includes(type)} onChange={() => toggle(type)} />
            {type}
          </label>
        ))}
      </div>

      {testTypes.includes("Other") && (
        <div>
          <label className={LABEL_CLASS}>Specify other test type</label>
          <input
            value={draft.otherTestType ?? ""}
            onChange={(e) => onChange({ otherTestType: e.target.value })}
            placeholder="Enter custom test type"
            className={INPUT_CLASS}
          />
        </div>
      )}
    </div>
  );
}
