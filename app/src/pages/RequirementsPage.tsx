import { useEffect, useRef, useState } from "react";
import { Brain, Loader2, Paperclip, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { api, ApiError } from "../lib/api";

type Requirement = {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  flows: string[];
  risks: string[];
  status: "Draft" | "InReview" | "Approved";
  priority: "Low" | "Medium" | "High";
  createdAt: string;
};

type AnalyzedCandidate = {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  flows: string[];
  risks: string[];
};

type EditDraft = {
  title: string;
  description: string;
  acceptanceCriteria: string;
  flows: string;
  risks: string;
  status: Requirement["status"];
  priority: Requirement["priority"];
};

const STATUS_STYLES: Record<Requirement["status"], string> = {
  Draft: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  InReview: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const PRIORITY_STYLES: Record<Requirement["priority"], string> = {
  Low: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  Medium: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  High: "bg-red-500/15 text-red-400 border-red-500/30",
};

const ACCEPTED_FILE_TYPES = ".pdf,.docx,image/png,image/jpeg,image/webp";

const INPUT_CLASS =
  "bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-300 outline-none focus:border-blue-600";
const TEXTAREA_SM_CLASS = `w-full ${INPUT_CLASS} rounded-lg px-2.5 py-1.5 text-xs resize-y`;
const SELECT_SM_CLASS = `${INPUT_CLASS} rounded-lg px-2 py-1.5 text-xs`;

function toLines(values: string[]) {
  return values.join("\n");
}

function fromLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function toEditDraft(r: Requirement): EditDraft {
  return {
    title: r.title,
    description: r.description,
    acceptanceCriteria: toLines(r.acceptanceCriteria),
    flows: toLines(r.flows),
    risks: toLines(r.risks),
    status: r.status,
    priority: r.priority,
  };
}

export default function RequirementsPage() {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");

  const [rawText, setRawText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [provider, setProvider] = useState("gemini");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [candidates, setCandidates] = useState<AnalyzedCandidate[] | null>(null);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    loadRequirements();
  }, []);

  async function loadRequirements() {
    setLoadingList(true);
    setListError("");
    try {
      setRequirements(await api.get<Requirement[]>("/api/requirements"));
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Could not load requirements.");
    } finally {
      setLoadingList(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
  }

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAnalyze() {
    if (!rawText.trim() && !file) return;
    setAnalyzing(true);
    setAnalyzeError("");
    setCandidates(null);
    setSearchedOnce(false);
    try {
      let found: AnalyzedCandidate[];
      if (file) {
        const form = new FormData();
        form.set("file", file);
        form.set("provider", provider);
        if (rawText.trim()) form.set("text", rawText);
        ({ candidates: found } = await api.post<{ candidates: AnalyzedCandidate[] }>(
          "/api/requirements/analyze",
          form,
          30000,
        ));
      } else {
        ({ candidates: found } = await api.post<{ candidates: AnalyzedCandidate[] }>(
          "/api/requirements/analyze",
          { text: rawText, provider },
          30000,
        ));
      }
      setCandidates(found);
      setSelected(new Set(found.map((_, i) => i)));
      setSearchedOnce(true);
    } catch (err) {
      setAnalyzeError(err instanceof ApiError ? err.message : "The analyzer is unavailable right now.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSaveSelected() {
    if (!candidates) return;
    setSaving(true);
    try {
      for (const index of selected) {
        const candidate = candidates[index];
        await api.post<Requirement>("/api/requirements", { ...candidate, sourceText: rawText || undefined });
      }
      setCandidates(null);
      setSearchedOnce(false);
      setRawText("");
      clearFile();
      setSelected(new Set());
      await loadRequirements();
    } catch (err) {
      setAnalyzeError(err instanceof ApiError ? err.message : "Could not save the selected requirements.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setRequirements((prev) => prev.filter((r) => r.id !== id));
    try {
      await api.delete(`/api/requirements/${id}`);
    } catch {
      await loadRequirements();
    }
  }

  function startEdit(r: Requirement) {
    setEditingId(r.id);
    setEditDraft(toEditDraft(r));
    setEditError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
    setEditError("");
  }

  async function handleSaveEdit(id: string) {
    if (!editDraft) return;
    setEditSaving(true);
    setEditError("");
    try {
      const updated = await api.patch<Requirement>(`/api/requirements/${id}`, {
        title: editDraft.title,
        description: editDraft.description,
        acceptanceCriteria: fromLines(editDraft.acceptanceCriteria),
        flows: fromLines(editDraft.flows),
        risks: fromLines(editDraft.risks),
        status: editDraft.status,
        priority: editDraft.priority,
      });
      setRequirements((prev) => prev.map((r) => (r.id === id ? updated : r)));
      cancelEdit();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setEditSaving(false);
    }
  }

  function toggleSelected(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Requirements</h1>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          Paste a spec, user story, or set of notes — or upload a PDF, Word doc, or image — and let the
          Requirement Analyzer extract testable requirements.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <Brain size={15} />
          </div>
          Requirement Analyzer
        </div>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste your spec, user story, or feature notes here…"
          rows={6}
          className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-blue-600 transition-colors resize-y"
        />

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={handleFileChange}
            className="hidden"
            id="requirement-file-input"
          />
          <label
            htmlFor="requirement-file-input"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded-lg px-3 py-1.5 cursor-pointer transition-colors"
          >
            <Paperclip size={12} /> Attach PDF, Word, or image
          </label>
          {file && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5">
              {file.name}
              <button onClick={clearFile} className="text-slate-400 dark:text-slate-500 hover:text-red-400" title="Remove file">
                <X size={12} />
              </button>
            </span>
          )}
        </div>

        {analyzeError && <p className="text-xs text-red-500 dark:text-red-400">{analyzeError}</p>}
        <div className="flex items-center gap-2">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-600 dark:text-slate-300 outline-none focus:border-blue-600 transition-colors"
          >
            <option value="gemini">Google Gemini</option>
            <option value="anthropic" disabled>
              Claude (Anthropic) — coming soon
            </option>
            <option value="openai" disabled>
              ChatGPT (OpenAI) — coming soon
            </option>
          </select>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || (!rawText.trim() && !file)}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
          >
            {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />}
            {analyzing ? "Analyzing…" : "Analyze with AI"}
          </button>
        </div>

        {searchedOnce && candidates && candidates.length === 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-800">
            Couldn't find a clear, testable requirement in that input — try adding more detail about what the
            feature should do.
          </p>
        )}

        {candidates && candidates.length > 0 && (
          <div className="pt-2 space-y-3 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Found {candidates.length} requirement{candidates.length === 1 ? "" : "s"} — review, then save
              the ones you want to keep.
            </p>
            {candidates.map((c, i) => (
              <label
                key={i}
                className={`flex gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  selected.has(i)
                    ? "border-blue-600/50 bg-blue-500/5"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggleSelected(i)}
                  className="mt-1"
                />
                <div className="space-y-1.5 text-sm">
                  <div className="font-medium text-slate-900 dark:text-white">{c.title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{c.description}</div>
                  {c.acceptanceCriteria.length > 0 && (
                    <div className="text-xs text-slate-400 dark:text-slate-500">
                      <span className="text-slate-500 dark:text-slate-400">Acceptance criteria:</span>{" "}
                      {c.acceptanceCriteria.join(" · ")}
                    </div>
                  )}
                  {c.risks.length > 0 && (
                    <div className="text-xs text-amber-600 dark:text-amber-500/80">Risks: {c.risks.join(" · ")}</div>
                  )}
                </div>
              </label>
            ))}
            <div className="flex gap-2">
              <button
                onClick={handleSaveSelected}
                disabled={saving || selected.size === 0}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save selected ({selected.size})
              </button>
              <button
                onClick={() => setCandidates(null)}
                className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-medium rounded-lg px-3.5 py-2"
              >
                <X size={13} /> Discard
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">Saved requirements</h2>
        </div>

        {loadingList ? (
          <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">Loading…</div>
        ) : listError ? (
          <div className="p-8 text-center text-sm text-red-500 dark:text-red-400">{listError}</div>
        ) : requirements.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
            <Plus size={18} className="text-slate-300 dark:text-slate-700" />
            No requirements yet. Analyze some text above to get started.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {requirements.map((r) =>
              editingId === r.id && editDraft ? (
                <div key={r.id} className="px-5 py-4 space-y-2.5 bg-slate-50 dark:bg-slate-950/40">
                  <input
                    value={editDraft.title}
                    onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                    placeholder="Title"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-600"
                  />
                  <textarea
                    value={editDraft.description}
                    onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                    placeholder="Description"
                    rows={2}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-600 dark:text-slate-300 outline-none focus:border-blue-600 resize-y"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-1">
                        Acceptance criteria (one per line)
                      </div>
                      <textarea
                        value={editDraft.acceptanceCriteria}
                        onChange={(e) => setEditDraft({ ...editDraft, acceptanceCriteria: e.target.value })}
                        rows={3}
                        className={TEXTAREA_SM_CLASS}
                      />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-1">Flows (one per line)</div>
                      <textarea
                        value={editDraft.flows}
                        onChange={(e) => setEditDraft({ ...editDraft, flows: e.target.value })}
                        rows={3}
                        className={TEXTAREA_SM_CLASS}
                      />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-1">Risks (one per line)</div>
                      <textarea
                        value={editDraft.risks}
                        onChange={(e) => setEditDraft({ ...editDraft, risks: e.target.value })}
                        rows={3}
                        className={TEXTAREA_SM_CLASS}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={editDraft.status}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, status: e.target.value as Requirement["status"] })
                      }
                      className={SELECT_SM_CLASS}
                    >
                      <option value="Draft">Draft</option>
                      <option value="InReview">In Review</option>
                      <option value="Approved">Approved</option>
                    </select>
                    <select
                      value={editDraft.priority}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, priority: e.target.value as Requirement["priority"] })
                      }
                      className={SELECT_SM_CLASS}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                    <div className="flex-1" />
                    {editError && <p className="text-xs text-red-500 dark:text-red-400">{editError}</p>}
                    <button
                      onClick={() => handleSaveEdit(r.id)}
                      disabled={editSaving || !editDraft.title.trim()}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors text-white text-xs font-medium rounded-lg px-3 py-1.5"
                    >
                      {editSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-medium rounded-lg px-3 py-1.5"
                    >
                      <X size={12} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div key={r.id} className="px-5 py-3.5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{r.title}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-2">
                      {r.description}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_STYLES[r.status]}`}>
                        {r.status}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${PRIORITY_STYLES[r.priority]}`}>
                        {r.priority}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(r)}
                      className="text-slate-400 dark:text-slate-600 hover:text-blue-400 transition-colors p-1"
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-slate-400 dark:text-slate-600 hover:text-red-400 transition-colors p-1"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
