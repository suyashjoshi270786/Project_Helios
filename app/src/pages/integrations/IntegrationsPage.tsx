import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { CARD_CLASS, INPUT_CLASS, LABEL_CLASS, BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS } from "../../lib/formStyles";

type ApiToken = {
  id: string;
  name: string;
  lastFour: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export default function IntegrationsPage() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [creating, setCreating] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [saving, setSaving] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setTokens(await api.get<ApiToken[]>("/api/api-tokens"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load API tokens.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newTokenName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const { token, ...summary } = await api.post<ApiToken & { token: string }>("/api/api-tokens", {
        name: newTokenName.trim(),
      });
      setTokens((prev) => [summary, ...prev]);
      setRevealedToken(token);
      setNewTokenName("");
      setCreating(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the token.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!window.confirm("Revoke this token? Anything using it will stop working immediately.")) return;
    setRevokingId(id);
    try {
      await api.delete(`/api/api-tokens/${id}`);
      setTokens((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not revoke the token.");
    } finally {
      setRevokingId(null);
    }
  }

  function copyRevealed() {
    if (!revealedToken) return;
    navigator.clipboard.writeText(revealedToken).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Integrations</h1>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          Generate API tokens so automation frameworks (CI runners, custom scripts) can update test results and
          test cycles in HeliosQE directly.
        </p>
      </div>

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      {revealedToken && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <ShieldAlert size={14} /> Copy this token now — you won't be able to see it again.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white dark:bg-slate-950 border border-emerald-300 dark:border-emerald-800 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 overflow-x-auto">
              {revealedToken}
            </code>
            <button
              onClick={copyRevealed}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 transition-colors text-white text-xs font-medium rounded-lg px-3 py-2 shrink-0"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setRevealedToken(null)}
            className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            Done, I've saved it
          </button>
        </div>
      )}

      <div className={CARD_CLASS}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
            <KeyRound size={15} className="text-indigo-500" /> API Tokens
          </h2>
          {!creating && (
            <button onClick={() => setCreating(true)} className={BUTTON_PRIMARY_CLASS}>
              <Plus size={13} /> Create Token
            </button>
          )}
        </div>

        {creating && (
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-3 space-y-2">
            <label className={LABEL_CLASS}>Token name</label>
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder="e.g. Jenkins CI runner"
                className={INPUT_CLASS + " flex-1"}
              />
              <button
                onClick={handleCreate}
                disabled={saving || !newTokenName.trim()}
                className={BUTTON_PRIMARY_CLASS + " disabled:opacity-50"}
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                Create
              </button>
              <button
                onClick={() => {
                  setCreating(false);
                  setNewTokenName("");
                }}
                className={BUTTON_SECONDARY_CLASS}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">
            No API tokens yet. Create one to connect an automation framework.
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {tokens.map((token) => (
              <div key={token.id} className="flex items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{token.name}</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    hqe_••••{token.lastFour} · Last used: {formatDate(token.lastUsedAt)} · Created{" "}
                    {formatDate(token.createdAt)}
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(token.id)}
                  disabled={revokingId === token.id}
                  className="inline-flex items-center gap-1.5 text-red-500 hover:text-red-400 text-xs font-medium rounded-lg px-2 py-1.5 disabled:opacity-50 shrink-0"
                >
                  {revokingId === token.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={CARD_CLASS + " space-y-2"}>
        <h2 className="text-sm font-medium text-slate-900 dark:text-white">Using a token</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Send the token as a Bearer credential on any HeliosQE API request. Look up test cases and test cycles by
          their human-readable code — <code className="text-[11px]">TC-0001</code>, <code className="text-[11px]">CYC-0001</code> — so your
          automation never needs to know internal record IDs.
        </p>
        <pre className="bg-slate-900 dark:bg-slate-950 text-slate-200 text-[11px] rounded-lg p-3 overflow-x-auto">
{`curl ${API_BASE_URL}/api/test-cases?projectId=<projectId> \\
  -H "Authorization: Bearer hqe_..."`}
        </pre>
      </div>
    </div>
  );
}
