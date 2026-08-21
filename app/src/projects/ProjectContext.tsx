import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

export type Project = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
};

type CreateResult = { ok: boolean; error?: string; project?: Project };
type MutateResult = { ok: boolean; error?: string };

type ProjectContextValue = {
  projects: Project[];
  currentProject: Project | null;
  currentProjectId: string | null;
  loading: boolean;
  selectProject: (id: string) => void;
  createProject: (name: string, description?: string) => Promise<CreateResult>;
  updateProject: (id: string, fields: { name?: string; description?: string | null }) => Promise<MutateResult>;
  deleteProject: (id: string) => Promise<MutateResult>;
  refresh: () => Promise<void>;
};

const STORAGE_KEY = "heliosqe-current-project";

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setProjects([]);
      setLoading(false);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  async function refresh() {
    setLoading(true);
    try {
      const list = await api.get<Project[]>("/api/projects");
      setProjects(list);
      setCurrentProjectId((prev) => {
        if (prev && list.some((p) => p.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  function selectProject(id: string) {
    setCurrentProjectId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  async function createProject(name: string, description?: string): Promise<CreateResult> {
    if (!name.trim()) {
      return { ok: false, error: "Enter a project name." };
    }
    try {
      const project = await api.post<Project>("/api/projects", { name, description });
      setProjects((prev) => [...prev, project]);
      selectProject(project.id);
      return { ok: true, project };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Could not create project." };
    }
  }

  async function updateProject(
    id: string,
    fields: { name?: string; description?: string | null },
  ): Promise<MutateResult> {
    try {
      const updated = await api.patch<Project>(`/api/projects/${id}`, fields);
      setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Could not update project." };
    }
  }

  async function deleteProject(id: string): Promise<MutateResult> {
    try {
      await api.delete(`/api/projects/${id}`);
      const remaining = projects.filter((p) => p.id !== id);
      setProjects(remaining);
      if (currentProjectId === id) {
        const next = remaining[0]?.id ?? null;
        if (next) selectProject(next);
        else {
          setCurrentProjectId(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Could not delete project." };
    }
  }

  const currentProject = projects.find((p) => p.id === currentProjectId) ?? null;

  return (
    <ProjectContext.Provider
      value={{
        projects,
        currentProject,
        currentProjectId,
        loading,
        selectProject,
        createProject,
        updateProject,
        deleteProject,
        refresh,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
