import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { TestPlanDraft } from "../types";
import { CARD_CLASS, INPUT_CLASS, LABEL_CLASS, SELECT_CLASS, TEST_STRATEGY_SECTIONS, TEXTAREA_CLASS } from "../constants";
import SuggestButton from "../components/SuggestButton";

type Props = { draft: TestPlanDraft; onChange: (partial: Partial<TestPlanDraft>) => void };

const BROWSER_OPTIONS = ["Chrome", "Edge", "Firefox", "Safari"];
const DATA_SOURCE_OPTIONS = ["QA Database", "Synthetic Data", "Masked Production Data", "Generated Data", "External Dataset", "Other"];
const SENSITIVE_DATA_OPTIONS = ["No production data", "Masked data required", "Synthetic data preferred", "Other"];

function TagList({
  title,
  items,
  onChange,
  placeholder,
  accent,
}: {
  title: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  accent: string;
}) {
  const [value, setValue] = useState("");

  function add() {
    if (!value.trim()) return;
    onChange([...items, value.trim()]);
    setValue("");
  }

  return (
    <div className="space-y-2">
      <label className={LABEL_CLASS}>{title}</label>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${accent}`}
          >
            {item}
            <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="hover:opacity-70">
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className={INPUT_CLASS + " text-xs py-1.5"}
        />
        <button
          onClick={add}
          className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-500 hover:border-blue-500/50"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

export default function ScopeStrategyStep({ draft, onChange }: Props) {
  const testStrategy = draft.testStrategy ?? {};
  const relevantStrategySections = (draft.testTypes ?? []).filter((t) => TEST_STRATEGY_SECTIONS[t]);
  const envConfig = draft.environmentConfig ?? {};
  const browsers = envConfig.browsers ?? [];
  const dataStrategy = draft.testDataStrategy ?? {};

  return (
    <div className="space-y-5">
      <div className={CARD_CLASS + " space-y-4"}>
        <h2 className="text-sm font-medium text-slate-900 dark:text-white">3. Scope</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TagList
            title="In Scope"
            items={draft.inScope ?? []}
            onChange={(inScope) => onChange({ inScope })}
            placeholder="Add a module or feature…"
            accent="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          />
          <TagList
            title="Out of Scope"
            items={draft.outOfScope ?? []}
            onChange={(outOfScope) => onChange({ outOfScope })}
            placeholder="Add a module or feature…"
            accent="border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
          />
        </div>
      </div>

      <div className={CARD_CLASS + " space-y-3"}>
        <h2 className="text-sm font-medium text-slate-900 dark:text-white">Test Strategy</h2>
        {relevantStrategySections.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Select test types in the previous step to describe strategy for each.
          </p>
        ) : (
          relevantStrategySections.map((type) => (
            <div key={type}>
              <div className="flex items-center justify-between">
                <label className={LABEL_CLASS}>{TEST_STRATEGY_SECTIONS[type]}</label>
                <SuggestButton
                  field="testStrategy"
                  context={{ testType: type, testPhase: draft.testPhase, environment: draft.environment, inScope: draft.inScope }}
                  onSuggest={(text) => onChange({ testStrategy: { ...testStrategy, [type]: text } })}
                />
              </div>
              <textarea
                value={testStrategy[type] ?? ""}
                onChange={(e) => onChange({ testStrategy: { ...testStrategy, [type]: e.target.value } })}
                rows={2}
                className={TEXTAREA_CLASS}
              />
            </div>
          ))
        )}
      </div>

      <div className={CARD_CLASS + " space-y-3"}>
        <h2 className="text-sm font-medium text-slate-900 dark:text-white">Test Data Strategy</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Data Source</label>
            <select
              value={dataStrategy.dataSource ?? ""}
              onChange={(e) => onChange({ testDataStrategy: { ...dataStrategy, dataSource: e.target.value } })}
              className={SELECT_CLASS}
            >
              <option value="">Select…</option>
              {DATA_SOURCE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Sensitive Data Handling</label>
            <select
              value={dataStrategy.sensitiveDataHandling ?? ""}
              onChange={(e) =>
                onChange({ testDataStrategy: { ...dataStrategy, sensitiveDataHandling: e.target.value } })
              }
              className={SELECT_CLASS}
            >
              <option value="">Select…</option>
              {SENSITIVE_DATA_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className={LABEL_CLASS}>Data Requirements</label>
            <SuggestButton
              field="testDataRequirements"
              context={{
                testPhase: draft.testPhase,
                environment: draft.environment,
                inScope: draft.inScope,
                dataSource: dataStrategy.dataSource,
              }}
              onSuggest={(text) => onChange({ testDataStrategy: { ...dataStrategy, dataRequirements: text } })}
            />
          </div>
          <textarea
            value={dataStrategy.dataRequirements ?? ""}
            onChange={(e) => onChange({ testDataStrategy: { ...dataStrategy, dataRequirements: e.target.value } })}
            rows={2}
            placeholder="Valid and invalid customer accounts are required. No production PII should be used."
            className={TEXTAREA_CLASS}
          />
        </div>
      </div>

      <div className={CARD_CLASS + " space-y-3"}>
        <h2 className="text-sm font-medium text-slate-900 dark:text-white">Environment Configuration</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Application URL</label>
            <input
              value={envConfig.applicationUrl ?? ""}
              onChange={(e) => onChange({ environmentConfig: { ...envConfig, applicationUrl: e.target.value } })}
              placeholder="https://qa.example.com"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Operating System</label>
            <input
              value={envConfig.os ?? ""}
              onChange={(e) => onChange({ environmentConfig: { ...envConfig, os: e.target.value } })}
              placeholder="Windows"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Database</label>
            <input
              value={envConfig.database ?? ""}
              onChange={(e) => onChange({ environmentConfig: { ...envConfig, database: e.target.value } })}
              placeholder="Oracle"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>API Environment</label>
            <input
              value={envConfig.apiEnvironment ?? ""}
              onChange={(e) => onChange({ environmentConfig: { ...envConfig, apiEnvironment: e.target.value } })}
              placeholder="QA API"
              className={INPUT_CLASS}
            />
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS}>Browsers</label>
          <div className="flex flex-wrap gap-3">
            {BROWSER_OPTIONS.map((b) => (
              <label key={b} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={browsers.includes(b)}
                  onChange={() =>
                    onChange({
                      environmentConfig: {
                        ...envConfig,
                        browsers: browsers.includes(b) ? browsers.filter((x) => x !== b) : [...browsers, b],
                      },
                    })
                  }
                />
                {b}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
