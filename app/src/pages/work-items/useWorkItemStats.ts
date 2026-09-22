import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { WorkItem } from "./types";

export type WorkItemStats = {
  total: number;
  epics: number;
  features: number;
  tasks: number;
  bugs: number;
};

const EMPTY: WorkItemStats = { total: 0, epics: 0, features: 0, tasks: 0, bugs: 0 };

// Lightweight, shared across List/Board/Backlog so the stat-tile row stays in
// sync no matter which view the user is on. Reuses the existing unfiltered
// GET /api/work-items — fine at today's per-project scale; if a project ever
// grows large enough for this to matter, replace with a real counts endpoint.
export function useWorkItemStats(projectId: string | null): { stats: WorkItemStats; loading: boolean } {
  const [stats, setStats] = useState<WorkItemStats>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setStats(EMPTY);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<WorkItem[]>(`/api/work-items?projectId=${projectId}`)
      .then((items) => {
        if (cancelled) return;
        const next = { ...EMPTY, total: items.length };
        for (const item of items) {
          if (item.type === "Epic") next.epics++;
          else if (item.type === "Feature") next.features++;
          else if (item.type === "Story" || item.type === "Task" || item.type === "SubTask") next.tasks++;
          else if (item.type === "Defect") next.bugs++;
        }
        setStats(next);
      })
      .catch(() => {
        if (!cancelled) setStats(EMPTY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { stats, loading };
}
