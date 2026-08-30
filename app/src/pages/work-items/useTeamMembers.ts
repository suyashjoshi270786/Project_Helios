import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { TeamMemberRef } from "./types";

// Work item forms only know a projectId — resolve it to the project's team,
// then that team's roster, so assignee/reporter can be a real person instead
// of free text.
export function useTeamMembers(projectId: string | null | undefined) {
  const [members, setMembers] = useState<TeamMemberRef[]>([]);

  useEffect(() => {
    if (!projectId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const project = await api.get<{ teamId: string }>(`/api/projects/${projectId}`);
        const list = await api.get<TeamMemberRef[]>(`/api/teams/${project.teamId}/members`);
        if (!cancelled) setMembers(list);
      } catch {
        if (!cancelled) setMembers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return members;
}
