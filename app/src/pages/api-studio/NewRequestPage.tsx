import { useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { useProject } from "../../projects/ProjectContext";
import { BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS, INPUT_CLASS, LABEL_CLASS, SELECT_CLASS, HTTP_METHOD_OPTIONS } from "./constants";
import type { ApiStudioOutletContext } from "./ApiStudioLayout";
import type { ApiRequest, HttpMethod } from "./types";

export default function NewRequestPage() {
  const { currentProjectId } = useProject();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get("folderId");
  const { reloadTree } = useOutletContext<ApiStudioOutletContext>();

  const [name, setName] = useState("");
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !url.trim()) {
      setError("Name and URL are required.");
      return;
    }
    setSaving(true);
    try {
      const created = await api.post<ApiRequest>("/api/api-studio/requests", {
        projectId: currentProjectId,
        name: name.trim(),
        method,
        url: url.trim(),
        folderId: folderId || undefined,
      });
      await reloadTree();
      navigate(`/api-studio/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">New Request</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={LABEL_CLASS}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Get Customer" className={INPUT_CLASS} autoFocus />
        </div>

        <div className="flex gap-2">
          <div className="w-32 shrink-0">
            <label className={LABEL_CLASS}>Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as HttpMethod)} className={SELECT_CLASS}>
              {HTTP_METHOD_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className={LABEL_CLASS}>URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/v1/customers"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={() => navigate("/api-studio")} className={BUTTON_SECONDARY_CLASS}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={BUTTON_PRIMARY_CLASS}>
            {saving ? "Creating…" : "Create Request"}
          </button>
        </div>
      </form>
    </div>
  );
}
