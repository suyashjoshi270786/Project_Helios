import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, X } from "lucide-react";
import { api, ApiError } from "../../../lib/api";
import { INPUT_CLASS, LABEL_CLASS, SELECT_CLASS, MODULE_OPTIONS } from "../constants";
import type { ModuleKey } from "../types";

export type AccessRequest = { id: string; name: string; email: string; reason?: string | null; createdAt: string };

export default function ApproveAccessRequestModal({
  request,
  teamId,
  teamName,
  onClose,
  onApproved,
}: {
  request: AccessRequest;
  teamId: string;
  teamName: string;
  onClose: () => void;
  onApproved: (requestId: string) => void;
}) {
  const [role, setRole] = useState<"Admin" | "Member">("Member");
  const [modules, setModules] = useState<Set<ModuleKey>>(new Set());
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

  async function handleApprove() {
    setSaving(true);
    setError("");
    try {
      await api.post(`/api/access-requests/${request.id}/approve`, {
        teamId,
        role,
        modules: role === "Member" ? [...modules] : [],
      });
      onApproved(request.id);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not approve that request.");
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">Approve Access Request</h2>
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
          <div className="text-sm">
            <div className="font-medium text-slate-900 dark:text-white">{request.name}</div>
            <div className="text-xs text-slate-400 dark:text-slate-500">{request.email}</div>
            {request.reason && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">"{request.reason}"</p>}
          </div>
          <div>
            <label className={LABEL_CLASS}>Join team</label>
            <input value={teamName} disabled className={INPUT_CLASS + " opacity-60"} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as "Admin" | "Member")} className={SELECT_CLASS}>
              <option value="Member">Member — access only granted modules</option>
              <option value="Admin">Admin — full access, can invite people</option>
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
              {modules.size === 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">
                  No modules selected — this person won't see any project data until you grant some.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800">
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm font-medium px-3 py-2">
            Cancel
          </button>
          <button
            onClick={handleApprove}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            {saving ? "Approving…" : "Approve & Create Account"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
