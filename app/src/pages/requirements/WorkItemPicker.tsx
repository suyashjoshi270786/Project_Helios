import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useClickOutside } from "../../lib/useClickOutside";
import { SELECT_CLASS, LABEL_CLASS } from "../../lib/formStyles";
import { WORK_ITEM_TYPE_OPTIONS } from "../work-items/constants";
import { WORK_ITEM_TYPE_BADGE_CLASS } from "../work-items/constants";
import type { WorkItem, WorkItemType } from "../work-items/types";

export type PickedWorkItem = { id: string; key: string; title: string; type: WorkItemType };

// Matches the "Work Item Type" + "Work Item" two-step selector suggested for
// Requirement Source = Work Item: pick a type, then search/pick among items
// of that type. Each row shows its parent as breadcrumb context (the same
// "in {parent.key}" pattern WorkItemsListPage.tsx already uses), rather
// than a deep nested tree widget — search covers id/title/keyword, the type
// dropdown covers type filtering.
export default function WorkItemPicker({
  projectId,
  value,
  onSelect,
}: {
  projectId: string;
  value: PickedWorkItem | null;
  onSelect: (item: PickedWorkItem) => void;
}) {
  const [type, setType] = useState<WorkItemType>("Epic");
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false), open);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .get<WorkItem[]>(`/api/work-items?projectId=${projectId}&type=${type}`)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load work items.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, type]);

  const filtered = items.filter((item) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return item.key.toLowerCase().includes(q) || item.title.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-3">
      <div>
        <label className={LABEL_CLASS}>Work Item Type</label>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value as WorkItemType);
            setOpen(false);
          }}
          className={SELECT_CLASS}
        >
          {WORK_ITEM_TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div ref={containerRef} className="relative">
        <label className={LABEL_CLASS}>Work Item</label>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={SELECT_CLASS + " flex items-center justify-between text-left"}
        >
          {value ? (
            <span className="flex items-center gap-2 min-w-0">
              <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${WORK_ITEM_TYPE_BADGE_CLASS[value.type]}`}>
                {value.key}
              </span>
              <span className="truncate">{value.title}</span>
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">Select Work Item</span>
          )}
          <ChevronDown size={14} className="shrink-0 text-slate-400 dark:text-slate-600" />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg overflow-hidden">
            <div className="p-2 border-b border-slate-200 dark:border-slate-800">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by ID, title, or keyword…"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md pl-8 pr-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 px-3 py-3">
                  <Loader2 size={12} className="animate-spin" /> Loading…
                </div>
              ) : error ? (
                <div className="text-xs text-red-500 dark:text-red-400 px-3 py-3">{error}</div>
              ) : filtered.length === 0 ? (
                <div className="text-xs text-slate-400 dark:text-slate-500 px-3 py-3">
                  No {type.toLowerCase()} items {search.trim() ? "match that search" : "exist yet"}.
                </div>
              ) : (
                filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelect({ id: item.id, key: item.key, title: item.title, type: item.type });
                      setOpen(false);
                      setSearch("");
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${WORK_ITEM_TYPE_BADGE_CLASS[item.type]}`}>
                      {item.key}
                    </span>
                    <span className="text-xs text-slate-700 dark:text-slate-300 truncate min-w-0">{item.title}</span>
                    {item.parent && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 ml-auto">
                        in {item.parent.key}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
