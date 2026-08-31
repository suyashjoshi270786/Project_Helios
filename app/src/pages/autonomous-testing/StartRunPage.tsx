import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Bot } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useProject } from "../../projects/ProjectContext";
import { CARD_CLASS, INPUT_CLASS, LABEL_CLASS, TEXTAREA_CLASS, BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS } from "./constants";
import type { AutonomousRunSummary } from "./types";

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function StartRunPage() {
  const { currentProjectId, currentProject } = useProject();
  const navigate = useNavigate();

  const [targetUrl, setTargetUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [environment, setEnvironment] = useState("");
  const [appName, setAppName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [maxDepth, setMaxDepth] = useState("3");
  const [maxTests, setMaxTests] = useState("10");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function validate(): string | null {
    if (!currentProjectId) return "Select a project first.";
    if (!targetUrl.trim() || !isValidUrl(targetUrl.trim())) return "Enter a valid application URL (including https://).";
    if (!username.trim()) return "Username is required.";
    if (!password) return "Password is required.";
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const result = await api.post<AutonomousRunSummary>(
        "/api/autonomous-testing/runs",
        {
          projectId: currentProjectId,
          targetUrl: targetUrl.trim(),
          username,
          password,
          environment: environment.trim() || undefined,
          appName: appName.trim() || undefined,
          instructions: instructions.trim() || undefined,
          maxDepth: Number(maxDepth) || undefined,
          maxTests: Number(maxTests) || undefined,
        },
        15000,
      );
      navigate(`/autonomous-testing/${result.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start the autonomous run.");
    } finally {
      // Credentials never live beyond this request — cleared regardless of
      // outcome, never held in a ref/context/URL/localStorage.
      setUsername("");
      setPassword("");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <Bot size={18} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Start Autonomous Testing</h1>
          {currentProject && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Project: {currentProject.name}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className={`${CARD_CLASS} space-y-4`}>
        <div>
          <label className={LABEL_CLASS}>Application URL *</label>
          <input
            type="url"
            required
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://staging.example.com"
            className={INPUT_CLASS}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Username *</label>
            <input
              type="text"
              required
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Password *</label>
            <input
              type="password"
              required
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 -mt-2">
          Credentials are used once to log in and are never stored, logged, or included in reports.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Environment (optional)</label>
            <input
              type="text"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              placeholder="Staging"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Application name (optional)</label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="e.g. Acme Admin Console"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS}>Testing instructions (optional)</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            placeholder="Anything Helios should focus on or avoid while exploring."
            className={TEXTAREA_CLASS}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Maximum exploration depth</label>
            <input
              type="number"
              min={1}
              max={10}
              value={maxDepth}
              onChange={(e) => setMaxDepth(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Maximum test count</label>
            <input
              type="number"
              min={1}
              max={50}
              value={maxTests}
              onChange={(e) => setMaxTests(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button type="submit" disabled={submitting} className={BUTTON_PRIMARY_CLASS}>
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
            {submitting ? "Starting…" : "Start Autonomous Testing"}
          </button>
          <button type="button" onClick={() => navigate("/autonomous-testing")} className={BUTTON_SECONDARY_CLASS}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
