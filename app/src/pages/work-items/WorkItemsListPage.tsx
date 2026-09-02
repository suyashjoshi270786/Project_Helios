import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Plus, LayoutList, KanbanSquare, ListTodo } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useProject } from "../../projects/ProjectContext";
import {
  CARD_CLASS,
  WORK_ITEM_TYPE_BADGE_CLASS,
  WORK_ITEM_TYPE_LABELS,
  WORK_ITEM_TYPE_PLURAL_LABELS,
  WORK_ITEM_PRIORITY_OPTIONS,
  WORK_ITEM_STATUS_OPTIONS,
} from "./constants";
import type { WorkItem, WorkItemType } from "./types";

const TABS: WorkItemType[] = ["Epic", "Feature", "Story", "Task", "Defect", "Initiative"];

type EditableField = "title" | "priority" | "status";

// Mirrors the click-to-edit pattern already established in BacklogPage.tsx
// and KanbanBoardPage.tsx (Row/Card components) — this page previously had
// no inline editing at all, forcing a full navigation into the detail page
// for even a one-word rename. Title/priority are Owner/Admin-only
// (`canWrite`) to match the server's WRITE_ROLE_FIELDS gate in
// server/src/routes/workItems.ts; status is left ungated since any project
// member is already allowed to move an item through its normal workflow.
function Row({
  item,
  canWrite,
  onNavigate,
  onUpdate,
}: {
  item: WorkItem;
  canWrite: boolean;
  onNavigate: () => void;
  onUpdate: (id: string, fields: Partial<Pick<WorkItem, "title" | "priority" | "status">>) => void;
}) {
  const [editing, setEditing] = useState<EditableField | null>(null);
  const [titleDraft, setTitleDraft] = useState(item.title);

  function stop(e: React.SyntheticEvent) {
    e.stopPropagation();
  }

  return (
    <div
      onClick={() => editing === null && onNavigate()}
      className="w-full flex items-center justify-between gap-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors"
    >
      <div className="min-w-0 flex items-center gap-3">
        <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${WORK_ITEM_TYPE_BADGE_CLASS[item.type]}`}>
          {item.key}
        </span>
        {editing === "title" ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onClick={stop}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            onBlur={() => {
              setEditing(null);
              if (titleDraft.trim() && titleDraft.trim() !== item.title) onUpdate(item.id, { title: titleDraft.trim() });
              else setTitleDraft(item.title);
            }}
            className="flex-1 min-w-0 text-sm bg-white dark:bg-slate-950 border border-indigo-400 rounded px-1.5 py-0.5"
          />
        ) : (
          <span
            onClick={(e) => {
              if (!canWrite) return;
              stop(e);
              setTitleDraft(item.title);
              setEditing("title");
            }}
            title={canWrite ? "Click to rename" : undefined}
            className={`text-sm font-medium text-slate-900 dark:text-white truncate ${canWrite ? "hover:text-indigo-600 dark:hover:text-indigo-400 cursor-text" : ""}`}
          >
            {item.title}
          </span>
        )}
        {item.parent && (
          <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">in {item.parent.key}</span>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-400 dark:text-slate-500" onClick={stop}>
        {editing === "priority" ? (
          <select
            autoFocus
            defaultValue={item.priority ?? ""}
            onClick={stop}
            onChange={(e) => {
              onUpdate(item.id, { priority: e.target.value || null });
              setEditing(null);
            }}
            onBlur={() => setEditing(null)}
            className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1 py-0.5"
          >
            <option value="">—</option>
            {WORK_ITEM_PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        ) : (
          (item.priority || canWrite) && (
            <span
              onClick={(e) => {
                if (!canWrite) return;
                stop(e);
                setEditing("priority");
              }}
              title={canWrite ? "Click to change priority" : undefined}
              className={canWrite ? "hover:text-indigo-600 dark:hover:text-indigo-500 cursor-pointer" : ""}
            >
              {item.priority ?? "Set priority"}
            </span>
          )
        )}

        {editing === "status" ? (
          <select
            autoFocus
            defaultValue={item.status}
            onClick={stop}
            onChange={(e) => {
              onUpdate(item.id, { status: e.target.value });
              setEditing(null);
            }}
            onBlur={() => setEditing(null)}
            className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5"
          >
            {WORK_ITEM_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : (
          <span
            onClick={(e) => {
              stop(e);
              setEditing("status");
            }}
            title="Click to change status"
            className="inline-block px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:ring-1 hover:ring-indigo-400 cursor-pointer"
          >
            {item.status}
          </span>
        )}

        {item.childCount !== undefined && item.childCount > 0 && <span>{item.childCount} child items</span>}
      </div>
    </div>
  );
}

export default function WorkItemsListPage() {
  const { currentProjectId, currentProject, loading: projectLoading } = useProject();
  const navigate = useNavigate();
  const { type: typeParam } = useParams<{ type?: string }>();
  const activeType: WorkItemType = (TABS.find((t) => t === typeParam) as WorkItemType) ?? "Epic";

  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canWrite = !!currentProject && currentProject.myRole !== "Member";

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

  async function handleUpdate(id: string, fields: Partial<Pick<WorkItem, "title" | "priority" | "status">>) {
    const previous = items.find((i) => i.id === id);
    if (!previous) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...fields } : i)));
    try {
      const updated = await api.patch<WorkItem>(`/api/work-items/${id}`, fields);
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === id ? previous : i)));
      setError(err instanceof ApiError ? err.message : "Could not save that change.");
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
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
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
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
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
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {items.map((item) => (
              <Row
                key={item.id}
                item={item}
                canWrite={canWrite}
                onNavigate={() => navigate(`/work-items/${item.id}`)}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
