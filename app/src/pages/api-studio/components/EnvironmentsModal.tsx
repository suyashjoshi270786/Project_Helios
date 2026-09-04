import { useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, X } from "lucide-react";
import { api, ApiError } from "../../../lib/api";
import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
import {
  BUTTON_PRIMARY_CLASS,
  BUTTON_SECONDARY_CLASS,
  ENVIRONMENT_CLASSIFICATION_BADGE_CLASS,
  ENVIRONMENT_CLASSIFICATION_OPTIONS,
  INPUT_CLASS,
  LABEL_CLASS,
  SELECT_CLASS,
  VARIABLE_CLASSIFICATION_OPTIONS,
  VARIABLE_CLASSIFICATION_SECRET,
} from "../constants";
import type { ApiEnvironment, EnvironmentClassification, VariableClassification } from "../types";

function VariableRow({
  environmentId,
  variableKey,
  classification,
  hasValue,
  onChanged,
}: {
  environmentId: string;
  variableKey: string;
  classification: VariableClassification;
  hasValue: boolean;
  onChanged: () => void;
}) {
  const [value, setValue] = useState("");
  const [pendingClassification, setPendingClassification] = useState(classification);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isSecret = VARIABLE_CLASSIFICATION_SECRET.has(pendingClassification);

  async function handleUpsert() {
    setSaving(true);
    setError("");
    try {
      await api.patch(`/api/api-studio/environments/${environmentId}/variables/${encodeURIComponent(variableKey)}`, {
        classification: pendingClassification,
        ...(value ? { value } : {}),
      });
      setValue("");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this variable.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/api/api-studio/environments/${environmentId}/variables/${encodeURIComponent(variableKey)}`);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this variable.");
    }
  }

  return (
    <tr>
      <td className="pr-2 py-1 text-xs font-mono text-slate-700 dark:text-slate-300">{variableKey}</td>
      <td className="pr-2 py-1">
        <select
          value={pendingClassification}
          onChange={(e) => setPendingClassification(e.target.value as VariableClassification)}
          className={SELECT_CLASS + " text-xs py-1"}
        >
          {VARIABLE_CLASSIFICATION_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </td>
      <td className="pr-2 py-1">
        <input
          type={isSecret ? "password" : "text"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={hasValue ? (isSecret ? "•••••••• (unchanged)" : "(unchanged)") : "Value"}
          className={INPUT_CLASS + " text-xs py-1"}
        />
      </td>
      <td className="py-1 flex items-center gap-1">
        <button onClick={handleUpsert} disabled={saving} className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs disabled:opacity-50">
          Save
        </button>
        <button onClick={handleDelete} title="Delete variable" className="text-slate-400 hover:text-red-500">
          <Trash2 size={12} />
        </button>
        {error && <span className="text-[10px] text-red-500 dark:text-red-400 ml-1">{error}</span>}
      </td>
    </tr>
  );
}

function NewVariableRow({ environmentId, onChanged }: { environmentId: string; onChanged: () => void }) {
  const [key, setKey] = useState("");
  const [classification, setClassification] = useState<VariableClassification>("Configuration");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isSecret = VARIABLE_CLASSIFICATION_SECRET.has(classification);

  async function handleAdd() {
    if (!key.trim()) return;
    setSaving(true);
    setError("");
    try {
      await api.patch(`/api/api-studio/environments/${environmentId}/variables/${encodeURIComponent(key.trim())}`, {
        classification,
        value,
      });
      setKey("");
      setValue("");
      setClassification("Configuration");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add this variable.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-t border-slate-100 dark:border-slate-900">
      <td className="pr-2 py-1.5">
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="baseUrl" className={INPUT_CLASS + " text-xs py-1"} />
      </td>
      <td className="pr-2 py-1.5">
        <select value={classification} onChange={(e) => setClassification(e.target.value as VariableClassification)} className={SELECT_CLASS + " text-xs py-1"}>
          {VARIABLE_CLASSIFICATION_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </td>
      <td className="pr-2 py-1.5">
        <input
          type={isSecret ? "password" : "text"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value"
          className={INPUT_CLASS + " text-xs py-1"}
        />
      </td>
      <td className="py-1.5">
        <button onClick={handleAdd} disabled={saving || !key.trim()} className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50">
          <Plus size={12} /> Add
        </button>
        {error && <span className="text-[10px] text-red-500 dark:text-red-400 ml-1">{error}</span>}
      </td>
    </tr>
  );
}

export default function EnvironmentsModal({
  projectId,
  environments,
  onClose,
  onReload,
}: {
  projectId: string;
  environments: ApiEnvironment[];
  onClose: () => void;
  onReload: () => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(environments[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClassification, setNewClassification] = useState<EnvironmentClassification>("Development");
  const [error, setError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const selected = environments.find((e) => e.id === selectedId) ?? null;

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const created = await api.post<ApiEnvironment>("/api/api-studio/environments", {
        projectId,
        name: newName.trim(),
        classification: newClassification,
      });
      setNewName("");
      setCreating(false);
      await onReload();
      setSelectedId(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create environment.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/api/api-studio/environments/${id}`);
      if (selectedId === id) setSelectedId(null);
      await onReload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete environment.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">Manage Environments</h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-[180px_1fr] gap-5">
          <div className="space-y-1">
            {environments.map((env) => (
              <button
                key={env.id}
                onClick={() => setSelectedId(env.id)}
                className={`w-full flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
                  selectedId === env.id ? "bg-indigo-600/15 text-indigo-600 font-medium" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
                }`}
              >
                <span className="truncate">{env.name}</span>
                <span className={`text-[9px] px-1 py-0.5 rounded shrink-0 ${ENVIRONMENT_CLASSIFICATION_BADGE_CLASS[env.classification]}`}>
                  {env.classification.slice(0, 4).toUpperCase()}
                </span>
              </button>
            ))}

            {creating ? (
              <div className="space-y-1.5 pt-1">
                <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Environment name" className={INPUT_CLASS + " text-xs py-1"} />
                <select value={newClassification} onChange={(e) => setNewClassification(e.target.value as EnvironmentClassification)} className={SELECT_CLASS + " text-xs py-1"}>
                  {ENVIRONMENT_CLASSIFICATION_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <div className="flex gap-1">
                  <button onClick={handleCreate} className={BUTTON_PRIMARY_CLASS + " text-[11px] py-1 px-2"}>
                    Create
                  </button>
                  <button onClick={() => setCreating(false)} className={BUTTON_SECONDARY_CLASS + " text-[11px] py-1 px-2"}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setCreating(true)} className="w-full inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1.5">
                <Plus size={12} /> New Environment
              </button>
            )}
          </div>

          <div>
            {error && <p className="text-xs text-red-500 dark:text-red-400 mb-2">{error}</p>}
            {!selected ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 py-4">Select or create an environment to edit its variables.</p>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className={LABEL_CLASS + " mb-0"}>Variables — {selected.name}</label>
                  <button onClick={() => setPendingDeleteId(selected.id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                    Delete Environment
                  </button>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-400 dark:text-slate-500">
                      <th className="font-medium pb-1 pr-2">Key</th>
                      <th className="font-medium pb-1 pr-2">Classification</th>
                      <th className="font-medium pb-1 pr-2">Value</th>
                      <th className="font-medium pb-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.variables.map((v) => (
                      <VariableRow key={v.key} environmentId={selected.id} variableKey={v.key} classification={v.classification} hasValue={v.hasValue} onChanged={onReload} />
                    ))}
                    <NewVariableRow environmentId={selected.id} onChanged={onReload} />
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {pendingDeleteId && (
        <ConfirmDeleteModal
          title="Delete Environment"
          message="This permanently deletes this environment and all its variables. This cannot be undone."
          confirmLabel="Delete"
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={() => handleDelete(pendingDeleteId)}
        />
      )}
    </div>,
    document.body,
  );
}
