import { Plus, Trash2 } from "lucide-react";
import type { Dependency, Resource, Risk, Schedule, TestPlanDraft } from "../types";
import { CARD_CLASS, INPUT_CLASS, LABEL_CLASS, newId, openDatePicker, SELECT_CLASS } from "../constants";
import SuggestButton from "../components/SuggestButton";

type Props = { draft: TestPlanDraft; onChange: (partial: Partial<TestPlanDraft>) => void };

const SCHEDULE_FIELDS: { key: keyof Schedule; label: string }[] = [
  { key: "planningStart", label: "Planning Start" },
  { key: "planningEnd", label: "Planning End" },
  { key: "testDesignStart", label: "Test Design Start" },
  { key: "executionStart", label: "Execution Start" },
  { key: "executionEnd", label: "Execution End" },
  { key: "regression", label: "Regression" },
  { key: "signOff", label: "Sign-off" },
];

const DEPENDENCY_STATUSES: Dependency["status"][] = ["Available", "Pending", "Blocked", "Unknown"];

export default function ResourcesScheduleStep({ draft, onChange }: Props) {
  const resources = draft.resources ?? [];
  const risks = draft.risks ?? [];
  const dependencies = draft.dependencies ?? [];
  const schedule = draft.schedule ?? {};

  function updateResource(id: string, fields: Partial<Resource>) {
    onChange({ resources: resources.map((r) => (r.id === id ? { ...r, ...fields } : r)) });
  }
  function addResource() {
    onChange({ resources: [...resources, { id: newId(), role: "", name: "", responsibilities: "" }] });
  }
  function removeResource(id: string) {
    onChange({ resources: resources.filter((r) => r.id !== id) });
  }

  function updateRisk(id: string, fields: Partial<Risk>) {
    onChange({ risks: risks.map((r) => (r.id === id ? { ...r, ...fields } : r)) });
  }
  function addRisk() {
    onChange({
      risks: [...risks, { id: newId(), risk: "", probability: "Medium", impact: "Medium", mitigation: "", owner: "" }],
    });
  }
  function removeRisk(id: string) {
    onChange({ risks: risks.filter((r) => r.id !== id) });
  }

  function updateDependency(id: string, fields: Partial<Dependency>) {
    onChange({ dependencies: dependencies.map((d) => (d.id === id ? { ...d, ...fields } : d)) });
  }
  function addDependency() {
    onChange({ dependencies: [...dependencies, { id: newId(), name: "", status: "Unknown" }] });
  }
  function removeDependency(id: string) {
    onChange({ dependencies: dependencies.filter((d) => d.id !== id) });
  }

  return (
    <div className="space-y-5">
      <div className={CARD_CLASS + " space-y-3"}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">5. Resources</h2>
          <button onClick={addResource} className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-400">
            <Plus size={13} /> Add Resource
          </button>
        </div>
        {resources.length === 0 && <p className="text-xs text-slate-400 dark:text-slate-500">No resources added yet.</p>}
        {resources.map((r) => (
          <div key={r.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_2fr_auto] gap-2 items-start">
            <input
              value={r.role}
              onChange={(e) => updateResource(r.id, { role: e.target.value })}
              placeholder="Role (e.g. QA Lead)"
              className={INPUT_CLASS + " text-xs py-1.5"}
            />
            <input
              value={r.name}
              onChange={(e) => updateResource(r.id, { name: e.target.value })}
              placeholder="Name"
              className={INPUT_CLASS + " text-xs py-1.5"}
            />
            <input
              value={r.responsibilities}
              onChange={(e) => updateResource(r.id, { responsibilities: e.target.value })}
              placeholder="Responsibilities"
              className={INPUT_CLASS + " text-xs py-1.5"}
            />
            <button onClick={() => removeResource(r.id)} className="text-slate-400 hover:text-red-400 p-1.5">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className={CARD_CLASS + " space-y-3"}>
        <h2 className="text-sm font-medium text-slate-900 dark:text-white">Schedule</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {SCHEDULE_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className={LABEL_CLASS}>{label}</label>
              <input
                type="date"
                value={schedule[key] ?? ""}
                onChange={(e) => onChange({ schedule: { ...schedule, [key]: e.target.value || undefined } })}
                onClick={openDatePicker}
                onFocus={openDatePicker}
                className={INPUT_CLASS}
              />
            </div>
          ))}
        </div>
      </div>

      <div className={CARD_CLASS + " space-y-3"}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">Risks &amp; Mitigations</h2>
          <button onClick={addRisk} className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-400">
            <Plus size={13} /> Add Risk
          </button>
        </div>
        {risks.length === 0 && <p className="text-xs text-slate-400 dark:text-slate-500">No risks logged yet.</p>}
        {risks.map((r) => (
          <div key={r.id} className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <input
                value={r.risk}
                onChange={(e) => updateRisk(r.id, { risk: e.target.value })}
                placeholder="Describe the risk"
                className={INPUT_CLASS + " text-xs py-1.5"}
              />
              <SuggestButton
                field="riskDescription"
                context={{ testPhase: draft.testPhase, environment: draft.environment }}
                onSuggest={(text) => updateRisk(r.id, { risk: text })}
                compact
              />
              <button onClick={() => removeRisk(r.id)} className="text-slate-400 hover:text-red-400 p-1.5 shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <select
                value={r.probability}
                onChange={(e) => updateRisk(r.id, { probability: e.target.value })}
                className={SELECT_CLASS + " text-xs py-1.5"}
              >
                {["Low", "Medium", "High"].map((v) => (
                  <option key={v} value={v}>
                    Probability: {v}
                  </option>
                ))}
              </select>
              <select
                value={r.impact}
                onChange={(e) => updateRisk(r.id, { impact: e.target.value })}
                className={SELECT_CLASS + " text-xs py-1.5"}
              >
                {["Low", "Medium", "High"].map((v) => (
                  <option key={v} value={v}>
                    Impact: {v}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1 col-span-2 sm:col-span-1">
                <input
                  value={r.mitigation}
                  onChange={(e) => updateRisk(r.id, { mitigation: e.target.value })}
                  placeholder="Mitigation"
                  className={INPUT_CLASS + " text-xs py-1.5 flex-1"}
                />
                <SuggestButton
                  field="riskMitigation"
                  context={{ risk: r.risk }}
                  onSuggest={(text) => updateRisk(r.id, { mitigation: text })}
                  compact
                />
              </div>
              <input
                value={r.owner}
                onChange={(e) => updateRisk(r.id, { owner: e.target.value })}
                placeholder="Owner"
                className={INPUT_CLASS + " text-xs py-1.5"}
              />
            </div>
          </div>
        ))}
      </div>

      <div className={CARD_CLASS + " space-y-3"}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">Dependencies</h2>
          <button onClick={addDependency} className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-400">
            <Plus size={13} /> Add Dependency
          </button>
        </div>
        {dependencies.length === 0 && <p className="text-xs text-slate-400 dark:text-slate-500">No dependencies added yet.</p>}
        {dependencies.map((d) => (
          <div key={d.id} className="flex items-center gap-2">
            <input
              value={d.name}
              onChange={(e) => updateDependency(d.id, { name: e.target.value })}
              placeholder="e.g. Authentication Service"
              className={INPUT_CLASS + " text-xs py-1.5"}
            />
            <select
              value={d.status}
              onChange={(e) => updateDependency(d.id, { status: e.target.value as Dependency["status"] })}
              className={SELECT_CLASS + " text-xs py-1.5 !w-40"}
            >
              {DEPENDENCY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button onClick={() => removeDependency(d.id)} className="text-slate-400 hover:text-red-400 p-1.5">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
