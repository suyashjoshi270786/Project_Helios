import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Plus, LayoutList } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useProject } from "../../projects/ProjectContext";
import { CARD_CLASS, WORK_ITEM_TYPE_BADGE_CLASS, WORK_ITEM_TYPE_LABELS } from "./constants";
import type { WorkItem, WorkItemType } from "./types";

const TABS: WorkItemType[] = ["Epic", "Feature", "Story", "Task", "Initiative"];

export default function WorkItemsListPage() {
  const { currentProjectId, currentProject, loading: projectLoading } = useProject();
  const navigate = useNavigate();
  const { type: typeParam } = useParams<{ type?: string }>();
  const activeType: WorkItemType = (TABS.find((t) => t === typeParam) as WorkItemType) ?? "Epic";

  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentProjectId) {
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId, activeType]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const list = await api.get<WorkItem[]>(`/api/work-items?projectId=${currentProjectId}&type=${activeType}`);
      setItems(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load work items.");
    } finally {
      setLoading(false);
    }
  }

  if (!projectLoading && !currentProjectId) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Work Items</h1>
        <div className={CARD_CLASS + " text-center text-sm text-slate-400 dark:text-slate-500"}>
          Create a project first — Work Items live inside a project.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Work Items</h1>
          {currentProject && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Project: {currentProject.name}</p>
          )}
        </div>
        <button
          onClick={() => navigate(`/work-items/new?type=${activeType}`)}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
        >
          <Plus size={13} /> Create {WORK_ITEM_TYPE_LABELS[activeType]}
        </button>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => navigate(`/work-items/type/${t}`)}
            className={`px-3.5 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeType === t
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {WORK_ITEM_TYPE_LABELS[t]}s
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      <div className={CARD_CLASS}>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-6 justify-center">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-sm text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
            <LayoutList size={20} className="text-slate-300 dark:text-slate-700" />
            No {WORK_ITEM_TYPE_LABELS[activeType].toLowerCase()}s yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(`/work-items/${item.id}`)}
                className="w-full flex items-center justify-between gap-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${WORK_ITEM_TYPE_BADGE_CLASS[item.type]}`}>
                    {item.key}
                  </span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.title}</span>
                  {item.parent && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                      in {item.parent.key}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                  {item.priority && <span>{item.priority}</span>}
                  <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    {item.status}
                  </span>
                  {item.childCount !== undefined && item.childCount > 0 && <span>{item.childCount} child items</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
