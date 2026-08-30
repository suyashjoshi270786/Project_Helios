import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, X } from "lucide-react";
import { api, ApiError } from "../../../lib/api";
import { LABEL_CLASS, SELECT_CLASS, MODULE_OPTIONS } from "../constants";
import type { ModuleKey, TeamMember, TeamRole } from "../types";

export default function EditMemberModal({
  teamId,
  member,
  onClose,
  onSaved,
}: {
  teamId: string;
  member: TeamMember;
  onClose: () => void;
  onSaved: (updated: TeamMember) => void;
}) {
  const [role, setRole] = useState<TeamRole>(member.role);
  const [modules, setModules] = useState<Set<ModuleKey>>(new Set(member.modules));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleModule(key: ModuleKey) {
    setModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await api.patch(`/api/teams/${teamId}/members/${member.id}`, { role, modules: [...modules] });
      onSaved({ ...member, role, modules: [...modules] });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">{member.name}</h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
              <AlertCircle size={13} /> {error}
            </div>
          )}
          <div>
            <label className={LABEL_CLASS}>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as TeamRole)} className={SELECT_CLASS}>
              <option value="Owner">Owner — full access, manages the team</option>
              <option value="Admin">Admin — full access, can invite people</option>
              <option value="Member">Member — access only granted modules</option>
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

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800">
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm font-medium px-3 py-2">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
