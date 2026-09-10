import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { TeamMemberRef } from "./types";

// Work item forms only know a projectId — resolve it to this project's own
// roster (team-wide members plus anyone project-scoped into it), so
// assignee/reporter can be a real person instead of free text. Uses the
// name-only assignable-members endpoint (not /teams/:id/members, which is
// now Owner-only) so this keeps working for every role.
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
        const list = await api.get<TeamMemberRef[]>(`/api/projects/${projectId}/assignable-members`);
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
