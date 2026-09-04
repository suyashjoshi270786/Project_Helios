import { Plus, Trash2 } from "lucide-react";
import { ASSERTION_TYPE_GROUPS, ASSERTION_TYPE_META, INPUT_CLASS, SELECT_CLASS, newId } from "../../constants";
import type { AssertionDef, AssertionType } from "../../types";

function defaultName(type: AssertionType): string {
  return ASSERTION_TYPE_META[type]?.label ?? type;
}

export default function AssertionsTab({ assertions, onChange }: { assertions: AssertionDef[]; onChange: (rows: AssertionDef[]) => void }) {
  function update(index: number, patch: Partial<AssertionDef>) {
    onChange(assertions.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function remove(index: number) {
    onChange(assertions.filter((_, i) => i !== index));
  }

  function add() {
    const type: AssertionType = "StatusEquals";
    onChange([...assertions, { id: newId(), name: defaultName(type), type, expected: "200" }]);
  }

  return (
    <div className="space-y-2">
      {assertions.length === 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500 py-2">No assertions yet — add one to turn this request into a repeatable test.</p>
      )}
      {assertions.map((assertion, i) => {
        const meta = ASSERTION_TYPE_META[assertion.type];
        return (
          <div key={assertion.id} className="flex items-center gap-2 flex-wrap border-b border-slate-100 dark:border-slate-900 pb-2 last:border-b-0">
            <select
              value={assertion.type}
              onChange={(e) => {
                const type = e.target.value as AssertionType;
                update(i, { type, name: defaultName(type), target: undefined, expected: undefined });
              }}
              className={SELECT_CLASS + " w-56 text-xs py-1.5"}
            >
              {ASSERTION_TYPE_GROUPS.map((group) => (
                <optgroup key={group.category} label={group.category}>
                  {group.types.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {meta?.needsTarget && (
              <input
                value={assertion.target ?? ""}
                onChange={(e) => update(i, { target: e.target.value })}
                placeholder={meta.targetPlaceholder}
                className={INPUT_CLASS + " w-44 text-xs py-1.5"}
              />
            )}
            {meta?.needsExpected && (
              <input
                value={assertion.expected ?? ""}
                onChange={(e) => update(i, { expected: e.target.value })}
                placeholder={meta.expectedPlaceholder}
                className={INPUT_CLASS + " w-36 text-xs py-1.5"}
              />
            )}
            <button onClick={() => remove(i)} title="Remove assertion" className="text-slate-400 hover:text-red-500 ml-auto">
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}
      <button onClick={add} className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
        <Plus size={12} /> Add Assertion
      </button>
    </div>
  );
}
