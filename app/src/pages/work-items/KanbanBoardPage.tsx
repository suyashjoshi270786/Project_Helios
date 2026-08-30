import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Loader2, LayoutList, KanbanSquare, ListTodo, Clock, CalendarClock, Plus, Sparkles, X, Rows3, Columns3 } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useProject } from "../../projects/ProjectContext";
import { WORK_ITEM_TYPE_BADGE_CLASS, WORK_ITEM_STATUS_OPTIONS, WORK_ITEM_PRIORITY_OPTIONS, SELECT_CLASS } from "./constants";
import ItemMenu from "./components/ItemMenu";
import { useTeamMembers } from "./useTeamMembers";
import type { TeamMemberRef, WorkItem, WorkItemType } from "./types";

export const BOARD_TYPES: WorkItemType[] = ["Story", "Task", "SubTask", "Defect"];
const STALE_DAYS = 3;
const UNASSIGNED = "Unassigned";

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function dueBadge(dueDate: string | null | undefined): { label: string; className: string } | null {
  if (!dueDate) return null;
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: "Overdue", className: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400" };
  if (days <= 2) return { label: days === 0 ? "Due today" : `Due in ${days}d`, className: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400" };
  return { label: new Date(dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }), className: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400" };
}

function Card({
  item,
  dragging,
  teamMembers = [],
  canWrite = false,
  onUpdate,
  onChangeType,
  onDelete,
}: {
  item: WorkItem;
  dragging?: boolean;
  teamMembers?: TeamMemberRef[];
  canWrite?: boolean;
  onUpdate?: (id: string, fields: Partial<Pick<WorkItem, "title" | "priority" | "assigneeId">>) => void;
  onChangeType?: (id: string, type: WorkItemType) => void;
  onDelete?: (id: string) => void;
}) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: item.id, data: item });
  const [editing, setEditing] = useState<"priority" | "assignee" | "title" | null>(null);
  const [titleDraft, setTitleDraft] = useState(item.title);

  const stale = item.status !== "Done" && daysSince(item.updatedAt) >= STALE_DAYS;
  const due = dueBadge(item.dueDate);

  function stopDrag(e: React.SyntheticEvent) {
    e.stopPropagation();
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => !dragging && editing === null && navigate(`/work-items/${item.id}`)}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
          : undefined
      }
      className={`group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2 cursor-grab active:cursor-grabbing touch-none select-none ${
        dragging ? "shadow-lg rotate-2" : "hover:border-slate-300 dark:hover:border-slate-700"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${WORK_ITEM_TYPE_BADGE_CLASS[item.type]}`}>
          {item.key}
        </span>
        {editing === "priority" ? (
          <select
            autoFocus
            defaultValue={item.priority ?? ""}
            onPointerDown={stopDrag}
            onClick={stopDrag}
            onChange={(e) => {
              onUpdate?.(item.id, { priority: e.target.value || null });
              setEditing(null);
            }}
            onBlur={() => setEditing(null)}
            className="text-[10px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1 py-0.5 shrink-0"
          >
            <option value="">—</option>
            {WORK_ITEM_PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        ) : (
          <span
            onPointerDown={stopDrag}
            onClick={(e) => {
              if (!canWrite) return;
              stopDrag(e);
              setEditing("priority");
            }}
            title={canWrite ? "Click to change priority" : undefined}
            className={`text-[10px] text-slate-400 dark:text-slate-500 shrink-0 ${canWrite ? "hover:text-indigo-600 dark:hover:text-indigo-500 cursor-pointer" : ""}`}
          >
            {item.priority ?? "Set priority"}
          </span>
        )}
        {onChangeType && onDelete && (
          <ItemMenu
            currentType={item.type}
            onChangeType={(type) => onChangeType(item.id, type)}
            onDelete={() => onDelete(item.id)}
            canDelete={canWrite}
          />
        )}
      </div>

      {editing === "title" ? (
        <input
          autoFocus
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onPointerDown={stopDrag}
          onClick={stopDrag}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          onBlur={() => {
            setEditing(null);
            if (titleDraft.trim() && titleDraft.trim() !== item.title) onUpdate?.(item.id, { title: titleDraft.trim() });
            else setTitleDraft(item.title);
          }}
          className="w-full text-sm bg-white dark:bg-slate-950 border border-indigo-400 rounded px-1.5 py-1"
        />
      ) : (
        <p
          onPointerDown={canWrite ? stopDrag : undefined}
          onClick={(e) => {
            if (!canWrite) return;
            stopDrag(e);
            setTitleDraft(item.title);
            setEditing("title");
          }}
          title={canWrite ? "Click to rename" : undefined}
          className={`text-sm text-slate-800 dark:text-slate-200 leading-snug ${canWrite ? "hover:text-indigo-600 dark:hover:text-indigo-400 cursor-text" : ""}`}
        >
          {item.title}
        </p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {stale && (
          <span
            title={`No updates in ${daysSince(item.updatedAt)} days`}
            className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
          >
            <Clock size={9} /> Stale
          </span>
        )}
        {due && (
          <span
            title={item.dueDate ? new Date(item.dueDate).toLocaleDateString() : ""}
            className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${due.className}`}
          >
            <CalendarClock size={9} /> {due.label}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        {editing === "assignee" ? (
          <select
            autoFocus
            defaultValue={item.assigneeId ?? ""}
            onPointerDown={stopDrag}
            onClick={stopDrag}
            onChange={(e) => {
              onUpdate?.(item.id, { assigneeId: e.target.value || null });
              setEditing(null);
            }}
            onBlur={() => setEditing(null)}
            className="text-[11px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5"
          >
            <option value="">Unassigned</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        ) : (
          <span
            onPointerDown={stopDrag}
            onClick={(e) => {
              stopDrag(e);
              setEditing("assignee");
            }}
            title="Click to change assignee"
            className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-500 cursor-pointer"
          >
            {item.assignedTo || item.assignee ? (
              <>
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-[9px] font-medium text-slate-600 dark:text-slate-300 shrink-0">
                  {(item.assignedTo?.name ?? item.assignee!).charAt(0).toUpperCase()}
                </span>
                {item.assignedTo?.name ?? item.assignee}
              </>
            ) : (
              "Unassigned"
            )}
          </span>
        )}
      </div>
    </div>
  );
}

function Column({
  id,
  items,
  teamMembers,
  canWrite,
  onUpdate,
  onChangeType,
  onDelete,
  showEmptyHint,
}: {
  id: string;
  items: WorkItem[];
  teamMembers: TeamMemberRef[];
  canWrite: boolean;
  onUpdate: (id: string, fields: Partial<Pick<WorkItem, "title" | "priority" | "assigneeId">>) => void;
  onChangeType: (id: string, type: WorkItemType) => void;
  onDelete: (id: string) => void;
  showEmptyHint?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 rounded-lg p-2 min-h-[90px] border-2 border-dashed transition-colors ${
        isOver ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30" : "border-transparent bg-slate-100/60 dark:bg-slate-900/40"
      }`}
    >
      {items.length === 0 && showEmptyHint ? (
        <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 py-4">Drop items here</p>
      ) : (
        items.map((item) => (
          <Card key={item.id} item={item} teamMembers={teamMembers} canWrite={canWrite} onUpdate={onUpdate} onChangeType={onChangeType} onDelete={onDelete} />
        ))
      )}
    </div>
  );
}

function QuickAdd({ onCreate }: { onCreate: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  function submit() {
    if (title.trim()) onCreate(title.trim());
    setTitle("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-500 px-2 py-1.5"
      >
        <Plus size={13} /> Add item
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") {
          setTitle("");
          setOpen(false);
        }
      }}
      onBlur={submit}
      placeholder="Title, then press Enter…"
      className="w-full text-xs bg-white dark:bg-slate-950 border border-indigo-400 rounded-lg px-2 py-1.5"
    />
  );
}

function BoardPulsePanel({ summary, onClose }: { summary: string; onClose: () => void }) {
  const lines = summary.split("\n").filter((l) => l.trim());
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1.5 relative">
      <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
        <X size={14} />
      </button>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
        <Sparkles size={13} /> AI Board Pulse
      </div>
      {lines.map((line, i) =>
        line.trim().startsWith("-") ? (
          <p key={i} className="text-sm text-slate-600 dark:text-slate-300 pl-3">
            {line.trim()}
          </p>
        ) : (
          <p key={i} className="text-sm font-semibold text-slate-900 dark:text-white pt-1.5 first:pt-0">
            {line.trim()}
          </p>
        ),
      )}
    </div>
  );
}

export default function KanbanBoardPage() {
  const { currentProjectId, currentProject, loading: projectLoading } = useProject();
  const navigate = useNavigate();
  const teamMembers = useTeamMembers(currentProjectId);
  const canWrite = !!currentProject && currentProject.myRole !== "Member";

  const [typeFilter, setTypeFilter] = useState<WorkItemType | "All">("All");
  const [assigneeFilter, setAssigneeFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [groupByAssignee, setGroupByAssignee] = useState(false);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [pulseLoading, setPulseLoading] = useState(false);
  const [pulseSummary, setPulseSummary] = useState<string | null>(null);
  const [pulseError, setPulseError] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!currentProjectId) {
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId, typeFilter]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const types = typeFilter === "All" ? BOARD_TYPES : [typeFilter];
      const results = await Promise.all(
        types.map((t) => api.get<WorkItem[]>(`/api/work-items?projectId=${currentProjectId}&type=${t}`)),
      );
      setItems(results.flat());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the board.");
    } finally {
      setLoading(false);
    }
  }

  const assigneeOptions = useMemo(() => {
    const set = new Set(items.map((i) => i.assignedTo?.name || UNASSIGNED));
    return [...set].sort((a, b) => (a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b)));
  }, [items]);

  const filteredItems = useMemo(
    () =>
      items.filter(
        (i) =>
          (assigneeFilter === "All" || (i.assignedTo?.name || UNASSIGNED) === assigneeFilter) &&
          (priorityFilter === "All" || i.priority === priorityFilter),
      ),
    [items, assigneeFilter, priorityFilter],
  );

  function groupByStatus(list: WorkItem[]) {
    const byStatus = new Map<string, WorkItem[]>(WORK_ITEM_STATUS_OPTIONS.map((s) => [s, []]));
    for (const item of list) {
      if (!byStatus.has(item.status)) byStatus.set(item.status, []);
      byStatus.get(item.status)!.push(item);
    }
    return [...byStatus.entries()];
  }

  const columns = useMemo(() => groupByStatus(filteredItems), [filteredItems]);

  const swimlanes = useMemo(() => {
    if (!groupByAssignee) return null;
    const byAssignee = new Map<string, WorkItem[]>();
    for (const item of filteredItems) {
      const key = item.assignedTo?.name || UNASSIGNED;
      if (!byAssignee.has(key)) byAssignee.set(key, []);
      byAssignee.get(key)!.push(item);
    }
    return [...byAssignee.entries()]
      .sort(([a], [b]) => (a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b)))
      .map(([assignee, list]) => ({ assignee, columns: groupByStatus(list) }));
  }, [filteredItems, groupByAssignee]);

  function handleDragStart(event: DragStartEvent) {
    setActiveItem(items.find((i) => i.id === event.active.id) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    const newStatus = overId.includes("::") ? overId.split("::")[1] : overId;
    const item = items.find((i) => i.id === active.id);
    if (!item || item.status === newStatus) return;

    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i)));
    try {
      await api.patch(`/api/work-items/${item.id}`, { status: newStatus });
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: item.status } : i)));
      setError(err instanceof ApiError ? err.message : "Could not move that item.");
    }
  }

  async function handleUpdate(id: string, fields: Partial<Pick<WorkItem, "title" | "priority" | "assigneeId">>) {
    const previous = items.find((i) => i.id === id);
    if (!previous) return;
    const assignedTo = "assigneeId" in fields ? teamMembers.find((m) => m.id === fields.assigneeId) ?? null : undefined;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...fields, ...(assignedTo !== undefined ? { assignedTo } : {}) } : i)));
    try {
      const updated = await api.patch<WorkItem>(`/api/work-items/${id}`, fields);
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === id ? previous : i)));
      setError(err instanceof ApiError ? err.message : "Could not save that change.");
    }
  }

  async function handleChangeType(id: string, type: WorkItemType) {
    try {
      const updated = await api.patch<WorkItem>(`/api/work-items/${id}`, { type });
      setItems((prev) => (typeFilter === "All" ? prev.map((i) => (i.id === id ? updated : i)) : prev.filter((i) => i.id !== id)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change that item's type.");
    }
  }

  async function handleDelete(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item || !window.confirm(`Delete ${item.key}? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/work-items/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete that item.");
    }
  }

  async function handleQuickAdd(status: string, title: string) {
    if (!currentProjectId) return;
    const type = typeFilter === "All" ? "Task" : typeFilter;
    try {
      const created = await api.post<WorkItem>("/api/work-items", { projectId: currentProjectId, type, title, status });
      setItems((prev) => [...prev, created]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create that item.");
    }
  }

  async function handleBoardPulse() {
    if (!currentProjectId) return;
    setPulseLoading(true);
    setPulseError("");
    setPulseSummary(null);
    try {
      const { summary } = await api.post<{ summary: string }>(
        "/api/work-items/board-pulse",
        { projectId: currentProjectId, provider: "gemini" },
        30000,
      );
      setPulseSummary(summary);
    } catch (err) {
      setPulseError(err instanceof ApiError ? err.message : "Could not generate a board summary.");
    } finally {
      setPulseLoading(false);
    }
  }

  if (!projectLoading && !currentProjectId) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Kanban Board</h1>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 text-center text-sm text-slate-400 dark:text-slate-500">
          Create a project first — the board lives inside a project.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Kanban Board</h1>
          {currentProject && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Project: {currentProject.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleBoardPulse}
            disabled={pulseLoading}
            className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 disabled:opacity-60 transition-colors text-xs font-medium rounded-lg px-3 py-2"
          >
            {pulseLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            AI Board Pulse
          </button>
          <button
            onClick={() => navigate("/work-items/backlog")}
            className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2"
          >
            <ListTodo size={13} /> Backlog
          </button>
          <button
            onClick={() => navigate("/work-items")}
            className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2"
          >
            <LayoutList size={13} /> List View
          </button>
        </div>
      </div>

      {(pulseSummary || pulseError) &&
        (pulseError ? (
          <p className="text-xs text-red-500 dark:text-red-400">{pulseError}</p>
        ) : (
          <BoardPulsePanel summary={pulseSummary!} onClose={() => setPulseSummary(null)} />
        ))}

      <div className="flex items-center gap-2 flex-wrap">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as WorkItemType | "All")} className={SELECT_CLASS + " w-auto"}>
          <option value="All">All Types</option>
          {BOARD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === "SubTask" ? "Sub-Task" : t}
            </option>
          ))}
        </select>
        <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className={SELECT_CLASS + " w-auto"}>
          <option value="All">All Assignees</option>
          {assigneeOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={SELECT_CLASS + " w-auto"}>
          <option value="All">All Priorities</option>
          {WORK_ITEM_PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button
          onClick={() => setGroupByAssignee((v) => !v)}
          className={`inline-flex items-center gap-1.5 text-xs font-medium border rounded-lg px-3 py-2 transition-colors ${
            groupByAssignee
              ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400"
              : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          {groupByAssignee ? <Rows3 size={13} /> : <Columns3 size={13} />}
          {groupByAssignee ? "Swimlanes: Assignee" : "Group by Assignee"}
        </button>
      </div>

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-10 justify-center">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
          <KanbanSquare size={20} className="text-slate-300 dark:text-slate-700" />
          No work items to show on the board yet.
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {swimlanes ? (
            <div className="space-y-6">
              {swimlanes.map(({ assignee, columns: laneColumns }) => (
                <div key={assignee} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-medium text-slate-600 dark:text-slate-300 shrink-0">
                      {assignee === UNASSIGNED ? "?" : assignee.charAt(0).toUpperCase()}
                    </span>
                    <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">{assignee}</h3>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {laneColumns.map(([status, statusItems]) => (
                      <div key={status} className="w-64 shrink-0">
                        <div className="flex items-center justify-between px-1 pb-1.5">
                          <h4 className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{status}</h4>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">{statusItems.length}</span>
                        </div>
                        <Column
                          id={`${assignee}::${status}`}
                          items={statusItems}
                          teamMembers={teamMembers}
                          canWrite={canWrite}
                          onUpdate={handleUpdate}
                          onChangeType={handleChangeType}
                          onDelete={handleDelete}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {columns.map(([status, statusItems]) => (
                <div key={status} className="flex flex-col w-64 shrink-0">
                  <div className="flex items-center justify-between px-1 pb-2">
                    <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{status}</h3>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">{statusItems.length}</span>
                  </div>
                  <Column
                    id={status}
                    items={statusItems}
                    teamMembers={teamMembers}
                    canWrite={canWrite}
                    onUpdate={handleUpdate}
                    onChangeType={handleChangeType}
                    onDelete={handleDelete}
                    showEmptyHint
                  />
                  <div className="pt-1">
                    <QuickAdd onCreate={(title) => handleQuickAdd(status, title)} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <DragOverlay>{activeItem ? <Card item={activeItem} dragging /> : null}</DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
