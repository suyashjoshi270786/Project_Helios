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
import { Loader2, LayoutList, KanbanSquare, Plus, Play, CheckCircle2, Trash2, ListTodo } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useProject } from "../../projects/ProjectContext";
import { WORK_ITEM_TYPE_BADGE_CLASS, SPRINT_STATUS_BADGE_CLASS, WORK_ITEM_PRIORITY_OPTIONS } from "./constants";
import { BOARD_TYPES } from "./KanbanBoardPage";
import NewSprintModal from "./components/NewSprintModal";
import ItemMenu from "./components/ItemMenu";
import type { WorkItem, WorkItemType, Sprint } from "./types";

const BACKLOG_ID = "backlog";

function Row({
  item,
  onUpdate,
  onChangeType,
  onDelete,
}: {
  item: WorkItem;
  onUpdate: (id: string, fields: Partial<Pick<WorkItem, "priority" | "assignee">>) => void;
  onChangeType: (id: string, type: WorkItemType) => void;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id, data: item });
  const [editing, setEditing] = useState<"priority" | "assignee" | null>(null);
  const [assigneeDraft, setAssigneeDraft] = useState(item.assignee ?? "");

  function stopDrag(e: React.SyntheticEvent) {
    e.stopPropagation();
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && editing === null && navigate(`/work-items/${item.id}`)}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 } : undefined}
      className={`flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 last:border-b-0 cursor-grab active:cursor-grabbing touch-none select-none ${
        isDragging ? "shadow-lg opacity-90" : "hover:bg-slate-50 dark:hover:bg-slate-950/40"
      }`}
    >
      <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${WORK_ITEM_TYPE_BADGE_CLASS[item.type]}`}>
        {item.key}
      </span>
      <span className="text-sm text-slate-800 dark:text-slate-200 truncate flex-1">{item.title}</span>
      {item.storyPoints != null && (
        <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">{item.storyPoints} pts</span>
      )}

      {editing === "priority" ? (
        <select
          autoFocus
          defaultValue={item.priority ?? ""}
          onPointerDown={stopDrag}
          onClick={stopDrag}
          onChange={(e) => {
            onUpdate(item.id, { priority: e.target.value || null });
            setEditing(null);
          }}
          onBlur={() => setEditing(null)}
          className="text-[11px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1 py-0.5 shrink-0"
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
            stopDrag(e);
            setEditing("priority");
          }}
          title="Click to change priority"
          className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer shrink-0"
        >
          {item.priority ?? "Set priority"}
        </span>
      )}

      {editing === "assignee" ? (
        <input
          autoFocus
          value={assigneeDraft}
          onPointerDown={stopDrag}
          onClick={stopDrag}
          onChange={(e) => setAssigneeDraft(e.target.value)}
          onBlur={() => {
            onUpdate(item.id, { assignee: assigneeDraft.trim() || null });
            setEditing(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          placeholder="Assignee…"
          className="text-[11px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 w-24 shrink-0"
        />
      ) : (
        <span
          onPointerDown={stopDrag}
          onClick={(e) => {
            stopDrag(e);
            setAssigneeDraft(item.assignee ?? "");
            setEditing("assignee");
          }}
          title="Click to change assignee"
          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-medium text-slate-600 dark:text-slate-300 shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-400"
        >
          {item.assignee ? item.assignee.charAt(0).toUpperCase() : "?"}
        </span>
      )}
      <ItemMenu currentType={item.type} onChangeType={(type) => onChangeType(item.id, type)} onDelete={() => onDelete(item.id)} />
    </div>
  );
}

function Container({
  id,
  items,
  emptyLabel,
  onUpdate,
  onChangeType,
  onDelete,
}: {
  id: string;
  items: WorkItem[];
  emptyLabel: string;
  onUpdate: (id: string, fields: Partial<Pick<WorkItem, "priority" | "assignee">>) => void;
  onChangeType: (id: string, type: WorkItemType) => void;
  onDelete: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 border-dashed transition-colors overflow-hidden ${
        isOver ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30" : "border-transparent"
      }`}
    >
      {items.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-950/40 rounded-lg">
          {emptyLabel}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
          {items.map((item) => (
            <Row key={item.id} item={item} onUpdate={onUpdate} onChangeType={onChangeType} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function SprintSection({
  sprint,
  items,
  onTransition,
  onDelete,
  onUpdate,
  onChangeItemType,
  onDeleteItem,
}: {
  sprint: Sprint;
  items: WorkItem[];
  onTransition: (sprint: Sprint, status: Sprint["status"]) => void;
  onDelete: (sprint: Sprint) => void;
  onUpdate: (id: string, fields: Partial<Pick<WorkItem, "priority" | "assignee">>) => void;
  onChangeItemType: (id: string, type: WorkItemType) => void;
  onDeleteItem: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{sprint.name}</h2>
          <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${SPRINT_STATUS_BADGE_CLASS[sprint.status]}`}>
            {sprint.status}
          </span>
          {(sprint.startDate || sprint.endDate) && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
              {sprint.startDate?.slice(0, 10) ?? "?"} → {sprint.endDate?.slice(0, 10) ?? "?"}
            </span>
          )}
          <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
            {sprint.summary.done}/{sprint.summary.total} done · {sprint.summary.points} pts
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sprint.status === "Planned" && (
            <button
              onClick={() => onTransition(sprint, "Active")}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <Play size={12} /> Start Sprint
            </button>
          )}
          {sprint.status === "Active" && (
            <button
              onClick={() => onTransition(sprint, "Completed")}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              <CheckCircle2 size={12} /> Complete Sprint
            </button>
          )}
          <button onClick={() => onDelete(sprint)} className="text-slate-400 hover:text-red-400">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {sprint.goal && <p className="text-xs text-slate-400 dark:text-slate-500">{sprint.goal}</p>}
      <Container
        id={sprint.id}
        items={items}
        emptyLabel="Drag items here to add them to this sprint."
        onUpdate={onUpdate}
        onChangeType={onChangeItemType}
        onDelete={onDeleteItem}
      />
    </div>
  );
}

export default function BacklogPage() {
  const { currentProjectId, currentProject, loading: projectLoading } = useProject();
  const navigate = useNavigate();

  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNewSprint, setShowNewSprint] = useState(false);
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!currentProjectId) {
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [sprintList, itemResults] = await Promise.all([
        api.get<Sprint[]>(`/api/sprints?projectId=${currentProjectId}`),
        Promise.all(BOARD_TYPES.map((t) => api.get<WorkItem[]>(`/api/work-items?projectId=${currentProjectId}&type=${t}`))),
      ]);
      setSprints(sprintList);
      setItems(itemResults.flat().sort((a, b) => a.rank - b.rank));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the backlog.");
    } finally {
      setLoading(false);
    }
  }

  const itemsByContainer = useMemo(() => {
    const map = new Map<string, WorkItem[]>();
    map.set(BACKLOG_ID, []);
    for (const sprint of sprints) map.set(sprint.id, []);
    for (const item of items) {
      const key = item.sprintId ?? BACKLOG_ID;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [items, sprints]);

  async function handleUpdate(id: string, fields: Partial<Pick<WorkItem, "priority" | "assignee">>) {
    const previous = items.find((i) => i.id === id);
    if (!previous) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...fields } : i)));
    try {
      await api.patch(`/api/work-items/${id}`, fields);
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === id ? previous : i)));
      setError(err instanceof ApiError ? err.message : "Could not save that change.");
    }
  }

  async function handleChangeType(id: string, type: WorkItemType) {
    try {
      const updated = await api.patch<WorkItem>(`/api/work-items/${id}`, { type });
      setItems((prev) => (BOARD_TYPES.includes(type) ? prev.map((i) => (i.id === id ? updated : i)) : prev.filter((i) => i.id !== id)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change that item's type.");
    }
  }

  async function handleDeleteItem(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item || !window.confirm(`Delete ${item.key}? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/work-items/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete that item.");
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveItem(items.find((i) => i.id === event.active.id) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;
    const targetSprintId = over.id === BACKLOG_ID ? null : (over.id as string);
    const item = items.find((i) => i.id === active.id);
    if (!item || (item.sprintId ?? null) === targetSprintId) return;

    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, sprintId: targetSprintId } : i)));
    try {
      await api.patch(`/api/work-items/${item.id}`, { sprintId: targetSprintId });
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, sprintId: item.sprintId } : i)));
      setError(err instanceof ApiError ? err.message : "Could not move that item.");
    }
  }

  async function handleTransition(sprint: Sprint, status: Sprint["status"]) {
    setError("");
    try {
      const updated = await api.post<Sprint>(`/api/sprints/${sprint.id}/transition`, { status });
      setSprints((prev) => prev.map((s) => (s.id === sprint.id ? updated : s)));
      if (status === "Completed") await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the sprint.");
    }
  }

  async function handleDeleteSprint(sprint: Sprint) {
    if (!window.confirm(`Delete "${sprint.name}"? Its items will return to the backlog.`)) return;
    try {
      await api.delete(`/api/sprints/${sprint.id}`);
      setSprints((prev) => prev.filter((s) => s.id !== sprint.id));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete that sprint.");
    }
  }

  if (!projectLoading && !currentProjectId) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Backlog</h1>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 text-center text-sm text-slate-400 dark:text-slate-500">
          Create a project first — the backlog lives inside a project.
        </div>
      </div>
    );
  }

  const backlogItems = itemsByContainer.get(BACKLOG_ID) ?? [];
  const sortedSprints = [...sprints].sort((a, b) => {
    const order = { Active: 0, Planned: 1, Completed: 2 };
    return order[a.status] - order[b.status];
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Backlog</h1>
          {currentProject && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Project: {currentProject.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/work-items/board")}
            className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2"
          >
            <KanbanSquare size={13} /> Board View
          </button>
          <button
            onClick={() => navigate("/work-items")}
            className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2"
          >
            <LayoutList size={13} /> List View
          </button>
          <button
            onClick={() => setShowNewSprint(true)}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
          >
            <Plus size={13} /> New Sprint
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-10 justify-center">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="space-y-6">
            {sortedSprints.map((sprint) => (
              <SprintSection
                key={sprint.id}
                sprint={sprint}
                items={itemsByContainer.get(sprint.id) ?? []}
                onTransition={handleTransition}
                onDelete={handleDeleteSprint}
                onUpdate={handleUpdate}
                onChangeItemType={handleChangeType}
                onDeleteItem={handleDeleteItem}
              />
            ))}

            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Backlog</h2>
              {backlogItems.length === 0 && sprints.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
                  <ListTodo size={20} className="text-slate-300 dark:text-slate-700" />
                  No work items yet.
                </div>
              ) : (
                <Container
                  id={BACKLOG_ID}
                  items={backlogItems}
                  emptyLabel="Nothing in the backlog."
                  onUpdate={handleUpdate}
                  onChangeType={handleChangeType}
                  onDelete={handleDeleteItem}
                />
              )}
            </div>
          </div>
          <DragOverlay>
            {activeItem ? <Row item={activeItem} onUpdate={() => {}} onChangeType={() => {}} onDelete={() => {}} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {showNewSprint && currentProjectId && (
        <NewSprintModal
          projectId={currentProjectId}
          onClose={() => setShowNewSprint(false)}
          onCreated={(sprint) => setSprints((prev) => [...prev, sprint])}
        />
      )}
    </div>
  );
}
