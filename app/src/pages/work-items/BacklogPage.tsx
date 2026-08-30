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
import { useTeamMembers } from "./useTeamMembers";
import type { TeamMemberRef, WorkItem, WorkItemType, Sprint } from "./types";

const BACKLOG_ID = "backlog";
const itemDropId = (itemId: string) => `item:${itemId}`;

function Row({
  item,
  teamMembers,
  canWrite,
  onUpdate,
  onChangeType,
  onDelete,
}: {
  item: WorkItem;
  teamMembers: TeamMemberRef[];
  canWrite: boolean;
  onUpdate: (id: string, fields: Partial<Pick<WorkItem, "title" | "priority" | "storyPoints" | "assigneeId">>) => void;
  onChangeType: (id: string, type: WorkItemType) => void;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: item,
  });
  // Individually droppable (not just the container) so a drop can target
  // "insert near this row" — without this, dnd-kit can only ever report the
  // container id, so a same-list reorder had nothing to compute a new
  // position from and the list re-rendered in its original order (the
  // "snaps back after dragging" bug).
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: itemDropId(item.id) });
  const [editing, setEditing] = useState<"priority" | "assignee" | "title" | "points" | null>(null);
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [pointsDraft, setPointsDraft] = useState(item.storyPoints != null ? String(item.storyPoints) : "");

  function stopDrag(e: React.SyntheticEvent) {
    e.stopPropagation();
  }

  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && editing === null && navigate(`/work-items/${item.id}`)}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 } : undefined}
      className={`flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-slate-900 border-b-2 last:border-b-0 cursor-grab active:cursor-grabbing touch-none select-none transition-colors ${
        isDragging
          ? "shadow-lg opacity-90 border-slate-200 dark:border-slate-800"
          : isOver
            ? "border-indigo-500"
            : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/40"
      }`}
    >
      <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${WORK_ITEM_TYPE_BADGE_CLASS[item.type]}`}>
        {item.key}
      </span>
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
            if (titleDraft.trim() && titleDraft.trim() !== item.title) onUpdate(item.id, { title: titleDraft.trim() });
            else setTitleDraft(item.title);
          }}
          className="flex-1 text-sm bg-white dark:bg-slate-950 border border-indigo-400 rounded px-1.5 py-0.5"
        />
      ) : (
        <span
          onPointerDown={canWrite ? stopDrag : undefined}
          onClick={(e) => {
            if (!canWrite) return;
            stopDrag(e);
            setTitleDraft(item.title);
            setEditing("title");
          }}
          title={canWrite ? "Click to rename" : undefined}
          className={`text-sm text-slate-800 dark:text-slate-200 truncate flex-1 ${canWrite ? "hover:text-indigo-600 dark:hover:text-indigo-400 cursor-text" : ""}`}
        >
          {item.title}
        </span>
      )}

      {editing === "points" ? (
        <input
          autoFocus
          type="number"
          min={0}
          value={pointsDraft}
          onChange={(e) => setPointsDraft(e.target.value)}
          onPointerDown={stopDrag}
          onClick={stopDrag}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          onBlur={() => {
            setEditing(null);
            const parsed = pointsDraft.trim() === "" ? null : Number(pointsDraft);
            if (parsed !== item.storyPoints && (parsed === null || !Number.isNaN(parsed))) onUpdate(item.id, { storyPoints: parsed });
          }}
          className="w-14 text-[11px] bg-white dark:bg-slate-950 border border-indigo-400 rounded px-1 py-0.5 shrink-0"
        />
      ) : (
        <span
          onPointerDown={canWrite ? stopDrag : undefined}
          onClick={(e) => {
            if (!canWrite) return;
            stopDrag(e);
            setPointsDraft(item.storyPoints != null ? String(item.storyPoints) : "");
            setEditing("points");
          }}
          title={canWrite ? "Click to set story points" : undefined}
          className={`text-[11px] text-slate-400 dark:text-slate-500 shrink-0 ${canWrite ? "hover:text-indigo-600 dark:hover:text-indigo-500 cursor-pointer" : ""}`}
        >
          {item.storyPoints != null ? `${item.storyPoints} pts` : canWrite ? "Set points" : ""}
        </span>
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
          onPointerDown={canWrite ? stopDrag : undefined}
          onClick={(e) => {
            if (!canWrite) return;
            stopDrag(e);
            setEditing("priority");
          }}
          title={canWrite ? "Click to change priority" : undefined}
          className={`text-[11px] text-slate-400 dark:text-slate-500 shrink-0 ${canWrite ? "hover:text-indigo-600 dark:hover:text-indigo-500 cursor-pointer" : ""}`}
        >
          {item.priority ?? "Set priority"}
        </span>
      )}

      {editing === "assignee" ? (
        <select
          autoFocus
          defaultValue={item.assigneeId ?? ""}
          onPointerDown={stopDrag}
          onClick={stopDrag}
          onChange={(e) => {
            onUpdate(item.id, { assigneeId: e.target.value || null });
            setEditing(null);
          }}
          onBlur={() => setEditing(null)}
          className="text-[11px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 shrink-0"
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
          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-medium text-slate-600 dark:text-slate-300 shrink-0 cursor-pointer hover:ring-2 hover:ring-indigo-400"
        >
          {(item.assignedTo?.name ?? item.assignee) ? (item.assignedTo?.name ?? item.assignee)!.charAt(0).toUpperCase() : "?"}
        </span>
      )}
      <ItemMenu currentType={item.type} onChangeType={(type) => onChangeType(item.id, type)} onDelete={() => onDelete(item.id)} canDelete={canWrite} />
    </div>
  );
}

function Container({
  id,
  items,
  emptyLabel,
  teamMembers,
  canWrite,
  onUpdate,
  onChangeType,
  onDelete,
}: {
  id: string;
  items: WorkItem[];
  emptyLabel: string;
  teamMembers: TeamMemberRef[];
  canWrite: boolean;
  onUpdate: (id: string, fields: Partial<Pick<WorkItem, "title" | "priority" | "storyPoints" | "assigneeId">>) => void;
  onChangeType: (id: string, type: WorkItemType) => void;
  onDelete: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 border-dashed transition-colors overflow-hidden ${
        isOver ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30" : "border-transparent"
      }`}
    >
      {items.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-950/40 rounded-lg">
          {emptyLabel}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
          {items.map((item) => (
            <Row key={item.id} item={item} teamMembers={teamMembers} canWrite={canWrite} onUpdate={onUpdate} onChangeType={onChangeType} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function SprintSection({
  sprint,
  items,
  teamMembers,
  canWrite,
  onTransition,
  onDelete,
  onUpdate,
  onChangeItemType,
  onDeleteItem,
}: {
  sprint: Sprint;
  items: WorkItem[];
  teamMembers: TeamMemberRef[];
  canWrite: boolean;
  onTransition: (sprint: Sprint, status: Sprint["status"]) => void;
  onDelete: (sprint: Sprint) => void;
  onUpdate: (id: string, fields: Partial<Pick<WorkItem, "title" | "priority" | "storyPoints" | "assigneeId">>) => void;
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
        teamMembers={teamMembers}
        canWrite={canWrite}
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
  const teamMembers = useTeamMembers(currentProjectId);
  const canWrite = !!currentProject && currentProject.myRole !== "Member";

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

  async function handleUpdate(id: string, fields: Partial<Pick<WorkItem, "title" | "priority" | "storyPoints" | "assigneeId">>) {
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

    const item = items.find((i) => i.id === active.id);
    if (!item) return;

    const overId = String(over.id);
    const overItemId = overId.startsWith("item:") ? overId.slice(5) : null;
    if (overItemId === item.id) return; // dropped on itself — no-op

    const overItem = overItemId ? items.find((i) => i.id === overItemId) : null;
    const targetSprintId = overItem ? (overItem.sprintId ?? null) : overId === BACKLOG_ID ? null : overId;

    // A Member can still move an item between the backlog and a sprint (part
    // of the normal workflow), but reordering within the same list is a
    // reprioritization action reserved for Owner/Admin — skip it silently
    // rather than letting the drag "succeed" and then bounce back on a 403.
    const sprintUnchanged = (item.sprintId ?? null) === targetSprintId;
    if (sprintUnchanged && !canWrite) return;

    const containerKey = targetSprintId ?? BACKLOG_ID;
    const containerItems = (itemsByContainer.get(containerKey) ?? []).filter((i) => i.id !== item.id);

    let newRank: number;
    if (overItem) {
      const overIndex = containerItems.findIndex((i) => i.id === overItem.id);
      // Decide "insert before" vs "insert after" the target row by comparing
      // where the dragged item ended up relative to the target row's midpoint.
      const activeRect = active.rect.current.translated;
      const overRect = over.rect;
      const droppedBelowMidpoint = !!activeRect && activeRect.top > overRect.top + overRect.height / 2;
      const targetIndex = droppedBelowMidpoint ? overIndex + 1 : overIndex;
      const before = containerItems[targetIndex - 1];
      const after = containerItems[targetIndex];
      newRank = before && after ? (before.rank + after.rank) / 2 : before ? before.rank + 1 : after ? after.rank - 1 : 0;
    } else {
      // Dropped on the container background (not a specific row) — append to the end.
      const last = containerItems[containerItems.length - 1];
      newRank = last ? last.rank + 1 : 0;
    }

    // Note: can't skip on "newRank === item.rank" as a no-op check — many
    // legacy items share the schema's default rank (0), so a genuine reorder
    // between two same-ranked neighbors can legitimately recompute to the
    // same degenerate value. Position (not the raw rank number) is what
    // determines whether anything actually moved.

    const previous = item;
    const withRank = (list: WorkItem[], replacement: WorkItem) =>
      list.map((i) => (i.id === item.id ? replacement : i)).sort((a, b) => a.rank - b.rank);

    setItems((prev) => withRank(prev, { ...item, sprintId: targetSprintId, rank: newRank }));
    try {
      await api.patch(`/api/work-items/${item.id}`, { sprintId: targetSprintId, rank: newRank });
    } catch (err) {
      setItems((prev) => withRank(prev, previous));
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
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
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
                teamMembers={teamMembers}
                canWrite={canWrite}
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
                  teamMembers={teamMembers}
                  canWrite={canWrite}
                  onUpdate={handleUpdate}
                  onChangeType={handleChangeType}
                  onDelete={handleDeleteItem}
                />
              )}
            </div>
          </div>
          <DragOverlay>
            {activeItem ? <Row item={activeItem} teamMembers={teamMembers} canWrite={canWrite} onUpdate={() => {}} onChangeType={() => {}} onDelete={() => {}} /> : null}
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
