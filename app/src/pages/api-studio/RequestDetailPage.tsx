import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Copy, Loader2, Play, Save, Send, Trash2 } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS, CARD_CLASS, INPUT_CLASS, SELECT_CLASS, HTTP_METHOD_OPTIONS, EXECUTE_CLIENT_TIMEOUT_MS } from "./constants";
import ResponseViewer from "./components/ResponseViewer";
import ExecutionHistoryList from "./components/ExecutionHistoryList";
import ParamsTab from "./components/tabs/ParamsTab";
import HeadersTab from "./components/tabs/HeadersTab";
import AuthTab from "./components/tabs/AuthTab";
import BodyTab from "./components/tabs/BodyTab";
import AssertionsTab from "./components/tabs/AssertionsTab";
import SettingsTab from "./components/tabs/SettingsTab";
import type { ApiStudioOutletContext } from "./ApiStudioLayout";
import type { ApiAuthType, ApiExecution, ApiRequest, AssertionDef, HttpMethod, KeyValuePair } from "./types";

type Draft = {
  name: string;
  method: HttpMethod;
  url: string;
  queryParams: KeyValuePair[];
  headers: KeyValuePair[];
  pathParams: KeyValuePair[];
  bodyType: "none" | "json" | "text";
  body: string;
  authType: ApiAuthType;
  authConfig: unknown;
  assertions: AssertionDef[];
  timeoutMs: number;
};

function toDraft(request: ApiRequest): Draft {
  return {
    name: request.name,
    method: request.method,
    url: request.url,
    queryParams: request.queryParams ?? [],
    headers: request.headers ?? [],
    pathParams: request.pathParams ?? [],
    bodyType: (request.bodyType as Draft["bodyType"]) ?? "none",
    body: request.body ?? "",
    authType: request.authType,
    authConfig: request.authConfig ?? {},
    assertions: request.assertions ?? [],
    timeoutMs: request.timeoutMs,
  };
}

const TABS = [
  { key: "params", label: "Params" },
  { key: "headers", label: "Headers" },
  { key: "auth", label: "Auth" },
  { key: "body", label: "Body" },
  { key: "assertions", label: "Assertions" },
  { key: "settings", label: "Settings" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function RequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { onRequestSaved, onRequestDeleted, reloadTree, selectedEnvironmentId } = useOutletContext<ApiStudioOutletContext>();

  const [request, setRequest] = useState<ApiRequest | null>(null);
  const [executions, setExecutions] = useState<ApiExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [draft, setDraft] = useState<Draft | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<Draft | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>("params");
  const [sending, setSending] = useState(false);
  const [activeExecution, setActiveExecution] = useState<ApiExecution | null>(null);
  const [rerunning, setRerunning] = useState(false);

  const isDirty = useMemo(() => draft !== null && savedSnapshot !== null && JSON.stringify(draft) !== JSON.stringify(savedSnapshot), [draft, savedSnapshot]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [loadedRequest, history] = await Promise.all([
        api.get<ApiRequest>(`/api/api-studio/requests/${requestId}`),
        api.get<ApiExecution[]>(`/api/api-studio/requests/${requestId}/executions`),
      ]);
      setRequest(loadedRequest);
      const snapshot = toDraft(loadedRequest);
      setDraft(snapshot);
      setSavedSnapshot(snapshot);
      setSavedAt(new Date(loadedRequest.updatedAt));
      setExecutions(history);
      setActiveExecution(history[0] ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this request.");
    } finally {
      setLoading(false);
    }
  }

  function patchDraft(patch: Partial<Draft>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function handleSave() {
    if (!request || !draft) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api.patch<ApiRequest>(`/api/api-studio/requests/${request.id}`, {
        name: draft.name.trim() || request.name,
        method: draft.method,
        url: draft.url.trim(),
        queryParams: draft.queryParams,
        headers: draft.headers,
        pathParams: draft.pathParams,
        bodyType: draft.bodyType,
        body: draft.bodyType === "none" ? null : draft.body,
        authType: draft.authType,
        authConfig: draft.authType === "None" ? {} : draft.authConfig,
        assertions: draft.assertions,
        timeoutMs: draft.timeoutMs,
      });
      setRequest(updated);
      const snapshot = toDraft(updated);
      setDraft(snapshot);
      setSavedSnapshot(snapshot);
      setSavedAt(new Date(updated.updatedAt));
      onRequestSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this request.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (!request || !draft) return;
    setSending(true);
    setError("");
    try {
      const execution = await api.post<ApiExecution>(
        `/api/api-studio/requests/${request.id}/execute`,
        {
          method: draft.method,
          url: draft.url.trim(),
          queryParams: draft.queryParams,
          headers: draft.headers,
          pathParams: draft.pathParams,
          bodyType: draft.bodyType,
          body: draft.bodyType === "none" ? null : draft.body,
          authType: draft.authType,
          authConfig: draft.authType === "None" ? {} : draft.authConfig,
          assertions: draft.assertions,
          timeoutMs: draft.timeoutMs,
          environmentId: selectedEnvironmentId,
        },
        EXECUTE_CLIENT_TIMEOUT_MS,
      );
      setExecutions((prev) => [execution, ...prev]);
      setActiveExecution(execution);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send this request.");
    } finally {
      setSending(false);
    }
  }

  async function handleRerun() {
    if (!request || !activeExecution) return;
    setRerunning(true);
    setError("");
    try {
      const retest = await api.post<ApiExecution>(`/api/api-studio/requests/${request.id}/executions/${activeExecution.id}/retest`);
      setExecutions((prev) => [retest, ...prev]);
      setActiveExecution(retest);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rerun assertions for this execution.");
    } finally {
      setRerunning(false);
    }
  }

  async function handleDelete() {
    if (!request) return;
    try {
      await api.delete(`/api/api-studio/requests/${request.id}`);
      onRequestDeleted(request.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this request.");
    }
  }

  async function handleClone() {
    if (!request) return;
    try {
      const clone = await api.post<ApiRequest>(`/api/api-studio/requests/${request.id}/clone`);
      await reloadTree();
      navigate(`/api-studio/${clone.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not clone this request.");
    }
  }

  function handleExport() {
    if (!request || !draft) return;
    const exportable = { name: draft.name, method: draft.method, url: draft.url, queryParams: draft.queryParams, headers: draft.headers, bodyType: draft.bodyType, body: draft.body, authType: draft.authType, authConfig: draft.authConfig, assertions: draft.assertions };
    const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.name.replace(/[^a-z0-9-_]+/gi, "_") || "request"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading || !draft) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-6 justify-center">
        <Loader2 size={14} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (!request) {
    return <p className="text-sm text-red-500 dark:text-red-400">{error || "Request not found."}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <input
            value={draft.name}
            onChange={(e) => patchDraft({ name: e.target.value })}
            className="text-lg font-semibold text-slate-900 dark:text-white bg-transparent outline-none border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 transition-colors min-w-0"
          />
          {isDirty && <span title="Unsaved changes" className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleClone} title="Clone" className={BUTTON_SECONDARY_CLASS}>
            <Copy size={13} /> Clone
          </button>
          <button onClick={handleExport} title="Export" className={BUTTON_SECONDARY_CLASS}>
            Export
          </button>
          <button onClick={handleDelete} className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-xs font-medium rounded-lg px-3 py-1.5">
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 -mt-3">{isDirty ? "Unsaved changes" : savedAt ? `Last saved ${savedAt.toLocaleString()}` : ""}</p>

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      <div className={CARD_CLASS + " space-y-4"}>
        <div className="flex gap-2">
          <div className="w-32 shrink-0">
            <select value={draft.method} onChange={(e) => patchDraft({ method: e.target.value as HttpMethod })} className={SELECT_CLASS}>
              {HTTP_METHOD_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <input value={draft.url} onChange={(e) => patchDraft({ url: e.target.value })} className={INPUT_CLASS} />
          </div>
          <button onClick={handleSend} disabled={sending} className={BUTTON_PRIMARY_CLASS}>
            <Send size={13} /> {sending ? "Sending…" : "Send"}
          </button>
          <button onClick={handleSave} disabled={saving || !isDirty} className={BUTTON_SECONDARY_CLASS}>
            <Save size={13} /> {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 -mx-5 px-5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {tab.label}
              {tab.key === "assertions" && draft.assertions.length > 0 && <span className="ml-1 text-[10px] text-slate-400">({draft.assertions.length})</span>}
            </button>
          ))}
        </div>

        <div className="pt-1">
          {activeTab === "params" && (
            <ParamsTab
              url={draft.url}
              queryParams={draft.queryParams}
              pathParams={draft.pathParams}
              onQueryParamsChange={(rows) => patchDraft({ queryParams: rows })}
              onPathParamsChange={(rows) => patchDraft({ pathParams: rows })}
            />
          )}
          {activeTab === "headers" && <HeadersTab headers={draft.headers} onChange={(rows) => patchDraft({ headers: rows })} />}
          {activeTab === "auth" && (
            <AuthTab
              authType={draft.authType}
              authConfig={draft.authConfig}
              onAuthTypeChange={(authType) => patchDraft({ authType })}
              onAuthConfigChange={(authConfig) => patchDraft({ authConfig })}
            />
          )}
          {activeTab === "body" && (
            <BodyTab bodyType={draft.bodyType} body={draft.body} onBodyTypeChange={(bodyType) => patchDraft({ bodyType })} onBodyChange={(body) => patchDraft({ body })} />
          )}
          {activeTab === "assertions" && <AssertionsTab assertions={draft.assertions} onChange={(rows) => patchDraft({ assertions: rows })} />}
          {activeTab === "settings" && <SettingsTab timeoutMs={draft.timeoutMs} onTimeoutMsChange={(timeoutMs) => patchDraft({ timeoutMs })} />}
        </div>
      </div>

      {activeExecution && (
        <div className={CARD_CLASS}>
          <h2 className="text-sm font-medium text-slate-900 dark:text-white mb-3">Response</h2>
          <ResponseViewer
            execution={activeExecution}
            onRerun={draft.assertions.length > 0 ? handleRerun : undefined}
            rerunning={rerunning}
          />
        </div>
      )}

      <div className={CARD_CLASS}>
        <h2 className="text-sm font-medium text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
          <Play size={13} className="text-slate-400" /> Execution History
        </h2>
        <ExecutionHistoryList executions={executions} onSelect={setActiveExecution} />
      </div>
    </div>
  );
}
