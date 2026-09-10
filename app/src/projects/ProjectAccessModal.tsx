import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ArrowLeft, Check, Copy, Loader2, Plus, ShieldAlert, X } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { INPUT_CLASS, LABEL_CLASS, SELECT_CLASS, MODULE_OPTIONS, ROLE_BADGE_CLASS } from "../pages/team/constants";
import type { ModuleKey, TeamRole } from "../pages/team/types";

type ProjectMemberRow = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: TeamRole;
  scope: "team" | "project";
};

type InviteResult = { email: string; temporaryPassword?: string };

// Two very different views depending on who opened it: an Owner sees the
// full roster (team-wide members plus anyone scoped into just this project)
// and can invite; an Admin never fetches the roster at all — they only get
// the invite form. That's a deliberate product decision (write without
// read), not an oversight, so the GET call below is skipped entirely for
// non-Owners rather than made-then-hidden.
export default function ProjectAccessModal({
  projectId,
  projectName,
  isOwner,
  onClose,
}: {
  projectId: string;
  projectName: string;
  isOwner: boolean;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<ProjectMemberRow[]>([]);
  const [loading, setLoading] = useState(isOwner);
  const [error, setError] = useState("");
  const [inviting, setInviting] = useState(!isOwner);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"Admin" | "Member">("Member");
  const [modules, setModules] = useState<Set<ModuleKey>>(new Set());
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOwner) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const list = await api.get<ProjectMemberRow[]>(`/api/projects/${projectId}/members`);
      setMembers(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load who has access.");
    } finally {
      setLoading(false);
    }
  }

  function toggleModule(key: ModuleKey) {
    setModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleInvite() {
    if (!email.trim() || !name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const added = await api.post<InviteResult>(`/api/projects/${projectId}/invites`, {
        name: name.trim(),
        email: email.trim(),
        role,
        modules: role === "Member" ? [...modules] : [],
      });
      setResult(added);
      if (isOwner) load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add that person.");
    } finally {
      setSaving(false);
    }
  }

  function copyCredentials() {
    if (!result?.temporaryPassword) return;
    navigator.clipboard.writeText(`Email: ${result.email}\nTemporary password: ${result.temporaryPassword}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function resetInviteForm() {
    setName("");
    setEmail("");
    setRole("Member");
    setModules(new Set());
    setResult(null);
    setError("");
  }

  const body = result ? (
    <div className="p-5 space-y-3">
      {result.temporaryPassword ? (
        <>
          <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
            <ShieldAlert size={13} className="shrink-0 mt-0.5" />
            A fresh temporary password was generated — copy these and send them to {result.email} directly (it
            won't be shown again). They'll be asked to set their own password on first login.
          </div>
          <div className="text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-1 text-slate-700 dark:text-slate-300">
            <div>Email: {result.email}</div>
            <div>Password: {result.temporaryPassword}</div>
          </div>
          <button
            onClick={copyCredentials}
            className="w-full inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy credentials"}
          </button>
        </>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {result.email} already had a HeliosQE account and can log in as usual — they now have access to "{projectName}" too.
        </p>
      )}
      {isOwner ? (
        <button onClick={resetInviteForm} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
          Add someone else
        </button>
      ) : (
        <button onClick={resetInviteForm} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
          Add another person
        </button>
      )}
    </div>
  ) : inviting ? (
    <>
      <div className="p-5 space-y-4">
        {error && (
          <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
            <AlertCircle size={13} /> {error}
          </div>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500">This grants access to "{projectName}" only — not any other project on the team.</p>
        <div>
          <label className={LABEL_CLASS}>Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className={INPUT_CLASS} autoFocus />
        </div>
        <div>
          <label className={LABEL_CLASS}>Email *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" className={INPUT_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as "Admin" | "Member")} className={SELECT_CLASS}>
            <option value="Member">Member — access only granted modules</option>
            <option value="Admin">Admin — full access to this project, can invite people</option>
          </select>
        </div>
        {role === "Member" && (
          <div>
            <label className={LABEL_CLASS}>Modules this person can access</label>
            <div className="space-y-1.5 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
              {MODULE_OPTIONS.map((m) => (
                <label key={m.value} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={modules.has(m.value)} onChange={() => toggleModule(m.value)} />
                  {m.label}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800">
        {isOwner ? (
          <button onClick={() => setInviting(false)} className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm font-medium">
            <ArrowLeft size={14} /> Back
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={handleInvite}
          disabled={saving || !email.trim() || !name.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-lg px-4 py-2"
        >
          {saving ? "Adding…" : "Add to This Project"}
        </button>
      </div>
    </>
  ) : (
    <>
      <div className="p-5">
        {error && (
          <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400 mb-3">
            <AlertCircle size={13} /> {error}
          </div>
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-6 justify-center">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : members.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">Nobody else has access to this project yet.</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm text-slate-800 dark:text-slate-200 truncate">{m.name}</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{m.email}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE_CLASS[m.role]}`}>{m.role}</span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    {m.scope === "team" ? "Whole team" : "This project only"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setInviting(true)}
          className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white text-sm font-medium rounded-lg px-4 py-2"
        >
          <Plus size={14} /> Invite to This Project
        </button>
      </div>
    </>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white truncate">
            {isOwner && !inviting && !result ? "Who Has Access" : "Manage Access"} — {projectName}
          </h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 shrink-0 ml-2">
            <X size={16} />
          </button>
        </div>
        {body}
      </div>
    </div>,
    document.body,
  );
}
