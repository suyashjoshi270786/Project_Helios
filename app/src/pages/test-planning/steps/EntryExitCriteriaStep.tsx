import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { Criterion, TestPlanDraft } from "../types";
import { CARD_CLASS, INPUT_CLASS, newId } from "../constants";

function CriteriaChecklist({
  title,
  items,
  onChange,
}: {
  title: string;
  items: Criterion[];
  onChange: (items: Criterion[]) => void;
}) {
  const [value, setValue] = useState("");

  function toggle(id: string) {
    onChange(items.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c)));
  }

  function remove(id: string) {
    onChange(items.filter((c) => c.id !== id));
  }

  function add() {
    if (!value.trim()) return;
    onChange([...items, { id: newId(), label: value.trim(), checked: false, custom: true }]);
    setValue("");
  }

  return (
    <div className={CARD_CLASS + " space-y-3"}>
      <h2 className="text-sm font-medium text-slate-900 dark:text-white">{title}</h2>
      <div className="space-y-1.5">
        {items.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 group">
            <input type="checkbox" checked={c.checked} onChange={() => toggle(c.id)} />
            <span className="flex-1">{c.label}</span>
            {c.custom && (
              <button
                onClick={() => remove(c.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition-opacity"
              >
                <X size={13} />
              </button>
            )}
          </label>
        ))}
      </div>
      <div className="flex gap-1.5 pt-1">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a custom criterion…"
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

type Props = { draft: TestPlanDraft; onChange: (partial: Partial<TestPlanDraft>) => void };

export default function EntryExitCriteriaStep({ draft, onChange }: Props) {
  return (
    <div className="space-y-5">
      <CriteriaChecklist
        title="4. Entry Criteria"
        items={draft.entryCriteria ?? []}
        onChange={(entryCriteria) => onChange({ entryCriteria })}
      />
      <CriteriaChecklist
        title="Exit Criteria"
        items={draft.exitCriteria ?? []}
        onChange={(exitCriteria) => onChange({ exitCriteria })}
      />
    </div>
  );
}
