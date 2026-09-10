import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, X, Pencil, UserMinus, Check, Trash2 } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../auth/AuthContext";
import { CARD_CLASS, BUTTON_PRIMARY_CLASS, ROLE_BADGE_CLASS, MODULE_OPTIONS } from "./constants";
import InviteMemberModal from "./components/InviteMemberModal";
import EditMemberModal from "./components/EditMemberModal";
import ApproveAccessRequestModal, { type AccessRequest } from "./components/ApproveAccessRequestModal";
import DeleteTeamModal from "./components/DeleteTeamModal";
import type { Team, TeamMember } from "./types";

function moduleLabels(keys: string[]): string {
  if (keys.length === 0) return "No modules granted";
  return keys.map((k) => MODULE_OPTIONS.find((m) => m.value === k)?.label ?? k).join(", ");
}

export default function TeamPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [approvingRequest, setApprovingRequest] = useState<AccessRequest | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [showDeleteTeam, setShowDeleteTeam] = useState(false);

  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? null;
  const isManager = activeTeam?.role === "Owner" || activeTeam?.role === "Admin";
  const isOwner = activeTeam?.role === "Owner";

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (activeTeamId) loadTeamDetail(activeTeamId);
  }, [activeTeamId]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const list = await api.get<Team[]>("/api/teams");
      setTeams(list);
      setActiveTeamId((prev) => prev ?? list[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your teams.");
    } finally {
      setLoading(false);
    }
  }

  async function loadTeamDetail(teamId: string) {
    try {
      const team = teams.find((t) => t.id === teamId);
      const isTeamOwner = team?.role === "Owner";
      const isTeamManager = isTeamOwner || team?.role === "Admin";
      // Only the Owner can see the roster at all — an Admin or Member never
      // even makes this request, not just gets a hidden 403 for it.
      const membersPromise = isTeamOwner ? api.get<TeamMember[]>(`/api/teams/${teamId}/members`) : Promise.resolve([]);
      const requestsPromise = isTeamManager ? api.get<AccessRequest[]>("/api/access-requests") : Promise.resolve([]);
      const [memberList, requestList] = await Promise.all([membersPromise, requestsPromise]);
      setMembers(memberList);
      setAccessRequests(requestList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load team members.");
    }
  }

  async function handleDenyRequest(request: AccessRequest) {
    if (!window.confirm(`Deny access request from ${request.name}?`)) return;
    setDecidingId(request.id);
    try {
      await api.post(`/api/access-requests/${request.id}/deny`);
      setAccessRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not deny that request.");
    } finally {
      setDecidingId(null);
    }
  }

  async function handleRemoveMember(member: TeamMember) {
    if (!activeTeamId) return;
    if (!window.confirm(`Remove ${member.name} from this team?`)) return;
    try {
      await api.delete(`/api/teams/${activeTeamId}/members/${member.id}`);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove that member.");
    }
  }

  async function handleDeleteTeam() {
    if (!activeTeamId) return;
    try {
      await api.delete(`/api/teams/${activeTeamId}`);
      setShowDeleteTeam(false);
      setTeams((prev) => prev.filter((t) => t.id !== activeTeamId));
      setActiveTeamId(null);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete that team.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-10 justify-center">
        <Loader2 size={14} className="animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Team</h1>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          Manage who's on your team and which modules they can access.
        </p>
      </div>

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      {teams.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTeamId(t.id)}
              className={`text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors ${
                t.id === activeTeamId
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400"
                  : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {activeTeam && (
        <>
          <div className={CARD_CLASS + " flex items-center justify-between flex-wrap gap-3"}>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{activeTeam.name}</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {activeTeam.memberCount} member{activeTeam.memberCount === 1 ? "" : "s"} · {activeTeam.projectCount} project
                {activeTeam.projectCount === 1 ? "" : "s"} · you're the {activeTeam.role}
              </p>
            </div>
            {isManager && (
              <button onClick={() => setShowInvite(true)} className={BUTTON_PRIMARY_CLASS}>
                <Plus size={13} /> Invite Someone
              </button>
            )}
          </div>

          {isOwner && (
          <div className={CARD_CLASS + " space-y-1"}>
            <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Members</h3>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0 overflow-hidden">
                      {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" /> : m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-slate-800 dark:text-slate-200 truncate">
                        {m.name} {m.email === user?.email && <span className="text-slate-400 dark:text-slate-500">(you)</span>}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                        {m.email}
                        {m.role === "Member" && <> · {moduleLabels(m.modules)}</>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE_CLASS[m.role]}`}>{m.role}</span>
                    {isOwner && m.role !== "Owner" && (
                      <button onClick={() => setEditingMember(m)} className="text-slate-400 hover:text-indigo-500" title="Edit role & modules">
                        <Pencil size={13} />
                      </button>
                    )}
                    {isManager && m.email !== user?.email && (
                      <button onClick={() => handleRemoveMember(m)} className="text-slate-400 hover:text-red-400" title="Remove from team">
                        <UserMinus size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {isManager && accessRequests.length > 0 && (
            <div className={CARD_CLASS + " space-y-1"}>
              <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Access Requests</h3>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {accessRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-800 dark:text-slate-200 truncate">{request.name}</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{request.email}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setApprovingRequest(request)}
                        disabled={decidingId === request.id}
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-50"
                      >
                        <Check size={12} /> Approve
                      </button>
                      <button
                        onClick={() => handleDenyRequest(request)}
                        disabled={decidingId === request.id}
                        className="text-slate-400 hover:text-red-400 disabled:opacity-50"
                        title="Deny"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isOwner && (
            <div className={CARD_CLASS + " border-red-200 dark:border-red-900/50"}>
              <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">Danger Zone</h3>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                  Permanently delete {activeTeam.name} and every project inside it. This cannot be undone.
                </p>
                <button
                  onClick={() => setShowDeleteTeam(true)}
                  className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 hover:text-red-500 border border-red-200 dark:border-red-900 text-xs font-medium rounded-lg px-3 py-2 shrink-0"
                >
                  <Trash2 size={13} /> Delete Team
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showInvite && activeTeamId && (
        <InviteMemberModal
          teamId={activeTeamId}
          onClose={() => setShowInvite(false)}
          onAdded={() => loadTeamDetail(activeTeamId)}
        />
      )}
      {editingMember && activeTeamId && (
        <EditMemberModal
          teamId={activeTeamId}
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSaved={(updated) => setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))}
        />
      )}
      {approvingRequest && activeTeamId && activeTeam && (
        <ApproveAccessRequestModal
          request={approvingRequest}
          teamId={activeTeamId}
          teamName={activeTeam.name}
          onClose={() => setApprovingRequest(null)}
          onApproved={(requestId) => setAccessRequests((prev) => prev.filter((r) => r.id !== requestId))}
        />
      )}
      {showDeleteTeam && activeTeam && (
        <DeleteTeamModal team={activeTeam} onCancel={() => setShowDeleteTeam(false)} onConfirm={handleDeleteTeam} />
      )}
    </div>
  );
}
