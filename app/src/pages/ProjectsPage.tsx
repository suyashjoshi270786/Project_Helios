import { useState } from "react";
import { FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProject, type Project } from "../projects/ProjectContext";
import NewProjectModal from "../projects/NewProjectModal";
import DeleteProjectModal from "../projects/DeleteProjectModal";

function EditableName({
  project,
  onSave,
  onCancel,
}: {
  project: Project;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(project.name);
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter" && value.trim()) onSave(value.trim());
        if (e.key === "Escape") onCancel();
      }}
      onBlur={() => {
        if (value.trim() && value.trim() !== project.name) onSave(value.trim());
        else onCancel();
      }}
      className="text-sm font-medium bg-white dark:bg-slate-950 border border-blue-500 rounded-md px-2 py-1 outline-none text-slate-900 dark:text-white w-full max-w-xs"
    />
  );
}

export default function ProjectsPage() {
  const { projects, currentProjectId, loading, selectProject, updateProject, deleteProject } = useProject();
  const [showNewProject, setShowNewProject] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleRename(id: string, name: string) {
    setRenamingId(null);
    setError("");
    const result = await updateProject(id, { name });
    if (!result.ok) setError(result.error || "Could not rename project.");
  }

  async function handleDelete(project: Project) {
    setError("");
    const result = await deleteProject(project.id);
    if (!result.ok) setError(result.error || "Could not delete project.");
    setDeletingProject(null);
  }

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

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

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
              <div key={p.id} className="group px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {renamingId === p.id ? (
                    <EditableName
                      project={p}
                      onSave={(name) => handleRename(p.id, name)}
                      onCancel={() => setRenamingId(null)}
                    />
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{p.name}</div>
                        <button
                          onClick={() => setRenamingId(p.id)}
                          title="Rename project"
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-400 shrink-0"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                      {p.description && (
                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">
                          {p.description}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      selectProject(p.id);
                      navigate("/requirements");
                    }}
                    disabled={p.id === currentProjectId}
                    className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3.5 py-2 disabled:opacity-50 disabled:cursor-default text-blue-500 hover:text-blue-400 border border-blue-500/30 hover:border-blue-400/50"
                  >
                    {p.id === currentProjectId ? "Current" : "Switch to this project"}
                  </button>
                  <button
                    onClick={() => setDeletingProject(p)}
                    title="Delete project"
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 shrink-0 p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}
      {deletingProject && (
        <DeleteProjectModal
          project={deletingProject}
          onCancel={() => setDeletingProject(null)}
          onConfirm={() => handleDelete(deletingProject)}
        />
      )}
    </div>
  );
}
