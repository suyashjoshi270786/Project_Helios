import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Plus, LayoutList, KanbanSquare, ListTodo, ChevronRight } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useProject } from "../../projects/ProjectContext";
import { CARD_CLASS, WORK_ITEM_TYPE_BADGE_CLASS, WORK_ITEM_TYPE_LABELS, WORK_ITEM_TYPE_PLURAL_LABELS } from "./constants";
import type { WorkItem, WorkItemType } from "./types";

const TABS: WorkItemType[] = ["Epic", "Feature", "Story", "Task", "Defect", "Initiative"];

export default function WorkItemsListPage() {
  const { currentProjectId, currentProject, loading: projectLoading } = useProject();
  const navigate = useNavigate();
  const { type: typeParam } = useParams<{ type?: string }>();
  const activeType: WorkItemType = (TABS.find((t) => t === typeParam) as WorkItemType) ?? "Epic";

  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [childrenByParent, setChildrenByParent] = useState<Record<string, WorkItem[]>>({});
  const [loadingChildren, setLoadingChildren] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentProjectId) {
      setLoading(false);
      return;
    }
    setExpanded(new Set());
    setChildrenByParent({});
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

  async function toggleExpand(item: WorkItem) {
    if (expanded.has(item.id)) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      return;
    }
    setExpanded((prev) => new Set(prev).add(item.id));
    if (childrenByParent[item.id]) return;
    setLoadingChildren((prev) => new Set(prev).add(item.id));
    try {
      const kids = await api.get<WorkItem[]>(`/api/work-items?projectId=${currentProjectId}&parentId=${item.id}`);
      setChildrenByParent((prev) => ({ ...prev, [item.id]: kids }));
    } catch {
      // Row stays expanded with no children shown; user can retry by collapsing/expanding again.
    } finally {
      setLoadingChildren((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  function renderItemRow(item: WorkItem, depth: number) {
    const hasChildren = (item.childCount ?? 0) > 0;
    const isExpanded = expanded.has(item.id);
    const isLoadingKids = loadingChildren.has(item.id);
    const kids = childrenByParent[item.id];

    return (
      <div key={item.id} className="border-b border-slate-200 dark:border-slate-800 last:border-b-0">
        <div
          onClick={() => navigate(`/work-items/${item.id}`)}
          className="w-full flex items-center justify-between gap-4 py-3 pr-1 text-left hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors cursor-pointer"
          style={{ paddingLeft: 8 + depth * 22 }}
        >
          <div className="min-w-0 flex items-center gap-2">
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(item);
                }}
                className="shrink-0 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500"
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                <ChevronRight size={14} className={`transition-transform ${isExpanded ? "rotate-90" : ""}`} />
              </button>
            ) : (
              <span className="w-[19px] shrink-0" />
            )}
            <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${WORK_ITEM_TYPE_BADGE_CLASS[item.type]}`}>
              {item.key}
            </span>
            <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.title}</span>
            {depth === 0 && item.parent && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">in {item.parent.key}</span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
            {item.priority && <span>{item.priority}</span>}
            <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              {item.status}
            </span>
            {hasChildren && (
              <span>
                {item.childCount} child item{item.childCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
        {isExpanded && (
          <div className="bg-slate-50/50 dark:bg-slate-950/20">
            {isLoadingKids ? (
              <div
                className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 py-2.5"
                style={{ paddingLeft: 8 + (depth + 1) * 22 }}
              >
                <Loader2 size={12} className="animate-spin" /> Loading…
              </div>
            ) : kids && kids.length > 0 ? (
              kids.map((kid) => renderItemRow(kid, depth + 1))
            ) : (
              <div className="text-xs text-slate-400 dark:text-slate-500 py-2.5" style={{ paddingLeft: 8 + (depth + 1) * 22 }}>
                No child items.
              </div>
            )}
          </div>
        )}
      </div>
    );
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/work-items/backlog")}
            className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2"
          >
            <ListTodo size={13} /> Backlog
          </button>
          <button
            onClick={() => navigate("/work-items/board")}
            className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2"
          >
            <KanbanSquare size={13} /> Board View
          </button>
          <button
            onClick={() => navigate(`/work-items/new?type=${activeType}`)}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
          >
            <Plus size={13} /> Create {WORK_ITEM_TYPE_LABELS[activeType]}
          </button>
        </div>
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
            {WORK_ITEM_TYPE_PLURAL_LABELS[t]}
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
            No {WORK_ITEM_TYPE_PLURAL_LABELS[activeType].toLowerCase()} yet.
          </div>
        ) : (
          <div>{items.map((item) => renderItemRow(item, 0))}</div>
        )}
      </div>
    </div>
  );
}
