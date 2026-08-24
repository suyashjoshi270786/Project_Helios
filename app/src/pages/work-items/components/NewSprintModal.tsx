import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, X } from "lucide-react";
import { api, ApiError } from "../../../lib/api";
import { INPUT_CLASS, TEXTAREA_CLASS, LABEL_CLASS, openDatePicker } from "../constants";
import type { Sprint } from "../types";

export default function NewSprintModal({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string;
  onClose: () => void;
  onCreated: (sprint: Sprint) => void;
}) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const sprint = await api.post<Sprint>("/api/sprints", {
        projectId,
        name: name.trim(),
        goal: goal || null,
        startDate: startDate || null,
        endDate: endDate || null,
      });
      onCreated(sprint);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the sprint.");
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">New Sprint</h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
              <AlertCircle size={13} /> {error}
            </div>
          )}
          <div>
            <label className={LABEL_CLASS}>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 1" className={INPUT_CLASS} autoFocus />
          </div>
          <div>
            <label className={LABEL_CLASS}>Goal</label>
            <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} className={TEXTAREA_CLASS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                onClick={openDatePicker}
                onFocus={openDatePicker}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                onClick={openDatePicker}
                onFocus={openDatePicker}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800">
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm font-medium px-3 py-2">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            {saving ? "Creating…" : "Create Sprint"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
