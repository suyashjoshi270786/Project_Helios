import { useState } from "react";
import { FolderKanban, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../projects/ProjectContext";
import NewProjectModal from "../projects/NewProjectModal";

export default function ProjectsPage() {
  const { projects, currentProjectId, loading, selectProject } = useProject();
  const [showNewProject, setShowNewProject] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Projects</h1>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Requirements and Test Plans live inside a project. Switch projects here or from the sidebar.
          </p>
        </div>
        <button
          onClick={() => setShowNewProject(true)}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
        >
          <Plus size={13} /> New Project
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
            <FolderKanban size={18} className="text-slate-300 dark:text-slate-700" />
            No projects yet. Create one to get started.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {projects.map((p) => (
              <div key={p.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{p.name}</div>
                  {p.description && (
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">
                      {p.description}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    selectProject(p.id);
                    navigate("/requirements");
                  }}
                  disabled={p.id === currentProjectId}
                  className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3.5 py-2 disabled:opacity-50 disabled:cursor-default text-blue-500 hover:text-blue-400 border border-blue-500/30 hover:border-blue-400/50"
                >
                  {p.id === currentProjectId ? "Current" : "Switch to this project"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}
    </div>
  );
}
