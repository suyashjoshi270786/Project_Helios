import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, Copy, ShieldAlert, X } from "lucide-react";
import { api, ApiError } from "../../../lib/api";
import { INPUT_CLASS, LABEL_CLASS, SELECT_CLASS, MODULE_OPTIONS } from "../constants";
import type { ModuleKey } from "../types";

type AddMemberResult = { email: string; temporaryPassword: string };

export default function InviteMemberModal({
  teamId,
  onClose,
  onAdded,
}: {
  teamId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"Admin" | "Member">("Member");
  const [modules, setModules] = useState<Set<ModuleKey>>(new Set());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AddMemberResult | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleModule(key: ModuleKey) {
    setModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleInvite() {
    if (!email.trim() || (!name.trim() && !email.trim())) return;
    setSaving(true);
    setError("");
    try {
      const added = await api.post<AddMemberResult>(`/api/teams/${teamId}/invites`, {
        name: name.trim() || email.trim(),
        email: email.trim(),
        role,
        modules: role === "Member" ? [...modules] : [],
      });
      onAdded();
      setResult(added);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add that person.");
    } finally {
      setSaving(false);
    }
  }

  function copyCredentials() {
    if (!result) return;
    navigator.clipboard.writeText(`Email: ${result.email}\nTemporary password: ${result.temporaryPassword}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (result) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-medium text-slate-900 dark:text-white">Added to the Team</h2>
            <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
              <X size={16} />
            </button>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
              <ShieldAlert size={13} className="shrink-0 mt-0.5" />
              A fresh temporary password was generated — copy these and send them to {result.email} directly (it
              won't be shown again, and their previous password no longer works). They'll be asked to set their
              own password on first login.
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
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">Invite Someone</h2>
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
          <p className="text-xs text-slate-400 dark:text-slate-500">
            A temporary password is generated and shown to you here — whether this email is brand new or already
            has a HeliosQE account.
          </p>
          <div>
            <label className={LABEL_CLASS}>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className={INPUT_CLASS} autoFocus />
          </div>
          <div>
            <label className={LABEL_CLASS}>Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              className={INPUT_CLASS}
            />
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
            onClick={handleInvite}
            disabled={saving || !email.trim() || !name.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            {saving ? "Adding…" : "Add to Team"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
