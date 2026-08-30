import { useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, Database, KeyRound, Loader2, Play, Shield, ShieldAlert, Trash2, Users as UsersIcon } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useProject } from "../../projects/ProjectContext";
import { CARD_CLASS, BUTTON_PRIMARY_CLASS, TEXTAREA_CLASS } from "../../lib/formStyles";

type CuratedQuery = { key: string; label: string };
type QueryResult = { rows: Record<string, unknown>[]; truncated: boolean };
type TeamUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  teams: { teamId: string; teamName: string; role: string }[];
};

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ResultsTable({ result }: { result: QueryResult }) {
  if (result.rows.length === 0) {
    return <p className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">No rows returned.</p>;
  }
  const columns = Object.keys(result.rows[0]);
  return (
    <div className="space-y-2">
      {result.truncated && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <AlertTriangle size={11} /> Showing the first {result.rows.length} rows.
        </p>
      )}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <tr>
              {columns.map((col) => (
                <th key={col} className="text-left font-medium text-slate-500 dark:text-slate-400 px-3 py-2 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {result.rows.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col} className="px-3 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-xs truncate" title={formatCell(row[col])}>
                    {formatCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MyTeamTab({ teamId }: { teamId: string }) {
  const [queries, setQueries] = useState<CuratedQuery[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<CuratedQuery[]>("/api/sql-console/curated").then(setQueries).catch(() => setQueries([]));
  }, []);

  async function run(key: string) {
    setActiveKey(key);
    setRunning(true);
    setError("");
    setResult(null);
    try {
      setResult(await api.post<QueryResult>(`/api/sql-console/curated/${key}/run`, { teamId }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not run that query.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {queries.map((q) => (
          <button
            key={q.key}
            onClick={() => run(q.key)}
            disabled={running}
            className={`text-xs font-medium rounded-lg px-3 py-2 border transition-colors disabled:opacity-50 ${
              activeKey === q.key
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400"
                : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>
      {running && (
        <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-6 justify-center">
          <Loader2 size={14} className="animate-spin" /> Running…
        </div>
      )}
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      {result && !running && <ResultsTable result={result} />}
    </div>
  );
}

function FullDatabaseTab() {
  const [sql, setSql] = useState("SELECT * FROM \"Project\" LIMIT 20");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setRunning(true);
    setError("");
    setResult(null);
    try {
      setResult(await api.post<QueryResult>("/api/sql-console/raw", { sql }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Query failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
        <AlertTriangle size={13} className="shrink-0 mt-0.5" />
        This queries the full database across every team, not just yours — read-only queries only (enforced at the
        database level, so a write can't succeed even if it slips past validation here).
      </div>
      <textarea
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        rows={5}
        spellCheck={false}
        className={TEXTAREA_CLASS + " font-mono text-xs"}
      />
      <button onClick={run} disabled={running || !sql.trim()} className={BUTTON_PRIMARY_CLASS}>
        {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
        Run Query
      </button>
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      {result && !running && <ResultsTable result={result} />}
    </div>
  );
}

type ResetCredentials = { userId: string; email: string; temporaryPassword: string };

function UsersTab() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetCredentials, setResetCredentials] = useState<ResetCredentials | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    return api
      .get<TeamUser[]>("/api/users")
      .then(setUsers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load users."))
      .finally(() => setLoading(false));
  }

  async function handleDelete(u: TeamUser) {
    if (!window.confirm(`Permanently delete ${u.name}'s account? Their created content stays with the team, reattributed to its owner.`)) {
      return;
    }
    setDeletingId(u.id);
    setError("");
    try {
      await api.delete(`/api/users/${u.id}`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete that account.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleResetPassword(u: TeamUser) {
    if (!window.confirm(`Reset ${u.name}'s password? Their current password stops working immediately.`)) return;
    setResettingId(u.id);
    setError("");
    setCopied(false);
    try {
      const result = await api.post<{ email: string; temporaryPassword: string }>(`/api/users/${u.id}/reset-password`);
      setResetCredentials({ userId: u.id, ...result });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset that password.");
    } finally {
      setResettingId(null);
    }
  }

  function copyResetCredentials() {
    if (!resetCredentials) return;
    navigator.clipboard
      .writeText(`Email: ${resetCredentials.email}\nTemporary password: ${resetCredentials.temporaryPassword}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
  }

  if (loading) return <p className="text-xs text-slate-400 dark:text-slate-500 py-6 text-center">Loading…</p>;

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {users.map((u) => (
          <div key={u.id}>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="text-sm text-slate-800 dark:text-slate-200 truncate">{u.name}</div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                  {u.email} · {u.teams.map((t) => `${t.teamName} (${t.role})`).join(", ")}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleResetPassword(u)}
                  disabled={resettingId === u.id}
                  className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 text-xs font-medium rounded-lg px-2 py-1.5 disabled:opacity-50"
                >
                  {resettingId === u.id ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                  Reset Password
                </button>
                <button
                  onClick={() => handleDelete(u)}
                  disabled={deletingId === u.id}
                  className="inline-flex items-center gap-1.5 text-red-500 hover:text-red-400 text-xs font-medium rounded-lg px-2 py-1.5 disabled:opacity-50"
                >
                  {deletingId === u.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Delete Account
                </button>
              </div>
            </div>
            {resetCredentials?.userId === u.id && (
              <div className="mb-2.5 space-y-2">
                <div className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
                  <ShieldAlert size={12} className="shrink-0 mt-0.5" />
                  This won't be shown again — copy it and send it to {u.name} directly. They'll be asked to set
                  their own password on next login.
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300 break-all">
                    {resetCredentials.temporaryPassword}
                  </code>
                  <button
                    onClick={copyResetCredentials}
                    className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white text-xs font-medium rounded-lg px-3 py-2 shrink-0"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SqlConsolePage() {
  const { currentProject } = useProject();
  const [tab, setTab] = useState<"team" | "full" | "users">("team");
  const canWrite = !!currentProject && currentProject.myRole !== "Member";

  if (!canWrite) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">SQL Console</h1>
        <div className={CARD_CLASS + " text-center text-sm text-slate-400 dark:text-slate-500"}>
          Only a team owner or admin can use the SQL console.
        </div>
      </div>
    );
  }

  const tabs: { key: typeof tab; label: string; icon: typeof Database }[] = [
    { key: "team", label: "My Team", icon: Shield },
    { key: "full", label: "Full Database (read-only)", icon: Database },
    { key: "users", label: "Users", icon: UsersIcon },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">SQL Console</h1>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          Read-only data access and account management for team owners and admins.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 border transition-colors ${
              tab === t.key
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400"
                : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      <div className={CARD_CLASS}>
        {tab === "team" && (currentProject ? <MyTeamTab teamId={currentProject.teamId} /> : null)}
        {tab === "full" && <FullDatabaseTab />}
        {tab === "users" && <UsersTab />}
      </div>
    </div>
  );
}
