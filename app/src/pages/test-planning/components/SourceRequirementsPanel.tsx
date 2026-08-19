import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api, ApiError } from "../../../lib/api";
import type { RequirementSummary } from "../types";
import { CARD_CLASS, SELECT_CLASS } from "../constants";

const PRIORITY_STYLES: Record<RequirementSummary["priority"], string> = {
  Low: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  Medium: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  High: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function SourceRequirementsPanel({
  projectId,
  selectedIds,
  onChange,
}: {
  projectId: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [requirements, setRequirements] = useState<RequirementSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<RequirementSummary[]>(`/api/requirements?projectId=${projectId}&status=Approved`)
      .then((list) => {
        if (!cancelled) setRequirements(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load requirements.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const filtered = requirements.filter((r) => {
    if (priorityFilter && r.priority !== priorityFilter) return false;
    if (search.trim() && !r.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const selectedSet = new Set(selectedIds);

  function toggle(id: string) {
    onChange(selectedSet.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  function selectAll() {
    onChange(requirements.map((r) => r.id));
  }

  function deselectAll() {
    onChange([]);
  }

  return (
    <div className={CARD_CLASS + " space-y-3"}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-900 dark:text-white">Source Requirements</h2>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">Loading…</p>
      ) : error ? (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      ) : requirements.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          No approved requirements in this project yet.
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {requirements.length} Approved Requirement{requirements.length === 1 ? "" : "s"}
          </p>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {selectedIds.length === requirements.length
              ? "All requirements selected"
              : `${selectedIds.length} of ${requirements.length} requirements selected`}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-2 py-1 text-xs flex-1 min-w-32">
              <Search size={12} className="text-slate-400 dark:text-slate-600" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="bg-transparent outline-none flex-1 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
            </div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className={SELECT_CLASS + " !w-auto text-xs py-1"}
            >
              <option value="">All priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <button onClick={selectAll} className="text-blue-500 hover:text-blue-400 font-medium">
              Select all
            </button>
            <button onClick={deselectAll} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium">
              Deselect all
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
            {filtered.map((r) => (
              <label
                key={r.id}
                className={`flex items-start gap-2 rounded-lg border p-2 cursor-pointer transition-colors ${
                  selectedSet.has(r.id)
                    ? "border-blue-600/50 bg-blue-500/5"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(r.id)}
                  onChange={() => toggle(r.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{r.title}</div>
                  <span
                    className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full border ${PRIORITY_STYLES[r.priority]}`}
                  >
                    {r.priority}
                  </span>
                </div>
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 py-2">No requirements match.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
