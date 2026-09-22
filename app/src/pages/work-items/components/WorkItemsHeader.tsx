import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutList, KanbanSquare, ListTodo, Layers, PanelsTopLeft, ListChecks, Bug } from "lucide-react";
import StatTile from "../../../components/StatTile";
import { useWorkItemStats } from "../useWorkItemStats";

export type WorkItemsView = "list" | "board" | "backlog";

const VIEW_STORAGE_KEY = "heliosqe-workitems-view";

export function getRememberedWorkItemsView(): WorkItemsView {
  const stored = localStorage.getItem(VIEW_STORAGE_KEY);
  return stored === "board" || stored === "backlog" ? stored : "list";
}

function rememberWorkItemsView(view: WorkItemsView) {
  localStorage.setItem(VIEW_STORAGE_KEY, view);
}

const VIEW_ROUTES: Record<WorkItemsView, string> = {
  list: "/work-items",
  board: "/work-items/board",
  backlog: "/work-items/backlog",
};

const VIEWS: { key: WorkItemsView; label: string; icon: typeof LayoutList }[] = [
  { key: "list", label: "List", icon: LayoutList },
  { key: "board", label: "Board", icon: KanbanSquare },
  { key: "backlog", label: "Backlog", icon: ListTodo },
];

// Shared across WorkItemsListPage / KanbanBoardPage / BacklogPage: one
// consistent header (title, stat tiles, view switcher) instead of each page
// rolling its own. The switcher remembers the user's last-picked view
// (localStorage, per browser) so returning to "Work Items" from the sidebar
// lands back where they left off — the customization piece of this pass.
export default function WorkItemsHeader({
  active,
  projectId,
  projectName,
  actions,
}: {
  active: WorkItemsView;
  projectId: string | null;
  projectName?: string;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  const { stats, loading: statsLoading } = useWorkItemStats(projectId);

  function goTo(view: WorkItemsView) {
    if (view === active) return;
    rememberWorkItemsView(view);
    navigate(VIEW_ROUTES[view]);
  }

  // Stat tiles always jump into the List view filtered to the relevant
  // type(s), regardless of which view (List/Board/Backlog) they're clicked
  // from — that's the one place all work item types are individually
  // browsable via tabs.
  function goToType(type: "Epic" | "Feature" | "Task" | "Defect") {
    rememberWorkItemsView("list");
    navigate(`/work-items/type/${type}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Work Items</h1>
          {projectName && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Project: {projectName}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-0.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5">
            {VIEWS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => goTo(key)}
                aria-current={active === key}
                className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-md px-2.5 py-1.5 transition-colors ${
                  active === key
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
          {actions}
        </div>
      </div>

      {!statsLoading && stats.total > 0 && (
        <div className="flex flex-wrap gap-2.5">
          <StatTile
            label="Total"
            value={stats.total}
            icon={PanelsTopLeft}
            tint="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
            onClick={() => goToType("Epic")}
            title="View all work items"
          />
          <StatTile
            label="Epics"
            value={stats.epics}
            icon={Layers}
            tint="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
            onClick={() => goToType("Epic")}
          />
          <StatTile
            label="Features"
            value={stats.features}
            icon={ListChecks}
            tint="bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400"
            onClick={() => goToType("Feature")}
          />
          <StatTile
            label="Tasks"
            value={stats.tasks}
            icon={ListTodo}
            tint="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
            onClick={() => goToType("Task")}
            title="Includes Stories, Tasks, and Sub-tasks — opens the Tasks tab"
          />
          <StatTile
            label="Bugs"
            value={stats.bugs}
            icon={Bug}
            tint="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
            onClick={() => goToType("Defect")}
          />
        </div>
      )}
    </div>
  );
}
