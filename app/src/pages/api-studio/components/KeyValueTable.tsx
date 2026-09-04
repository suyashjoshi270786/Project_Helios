import { Plus, Trash2 } from "lucide-react";
import { INPUT_CLASS } from "../constants";
import type { KeyValuePair } from "../types";

// Shared editable table for Query Parameters / Headers — enabled checkbox,
// key, value, description, delete, plus an "Add" row. Used by both
// ParamsTab and HeadersTab so the two stay visually and behaviorally
// identical, per the mockup's matching layouts for both tabs.
export default function KeyValueTable({
  rows,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}: {
  rows: KeyValuePair[];
  onChange: (rows: KeyValuePair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  function update(index: number, patch: Partial<KeyValuePair>) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function remove(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  function add() {
    onChange([...rows, { key: "", value: "", enabled: true, description: "" }]);
  }

  return (
    <div className="space-y-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-400 dark:text-slate-500">
            <th className="w-6 font-medium pb-1"></th>
            <th className="font-medium pb-1 pr-2">Key</th>
            <th className="font-medium pb-1 pr-2">Value</th>
            <th className="font-medium pb-1 pr-2">Description</th>
            <th className="w-6 font-medium pb-1"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td className="pr-1 py-0.5">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) => update(i, { enabled: e.target.checked })}
                  aria-label={`Enable ${row.key || "row"}`}
                />
              </td>
              <td className="pr-2 py-0.5">
                <input value={row.key} onChange={(e) => update(i, { key: e.target.value })} placeholder={keyPlaceholder} className={INPUT_CLASS + " py-1"} />
              </td>
              <td className="pr-2 py-0.5">
                <input value={row.value} onChange={(e) => update(i, { value: e.target.value })} placeholder={valuePlaceholder} className={INPUT_CLASS + " py-1"} />
              </td>
              <td className="pr-2 py-0.5">
                <input
                  value={row.description ?? ""}
                  onChange={(e) => update(i, { description: e.target.value })}
                  placeholder="Description"
                  className={INPUT_CLASS + " py-1"}
                />
              </td>
              <td className="py-0.5">
                <button onClick={() => remove(i)} title="Remove" className="text-slate-400 hover:text-red-500">
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={add} className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
        <Plus size={12} /> Add
      </button>
    </div>
  );
}
