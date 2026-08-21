import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowRight } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useProject } from "../../projects/ProjectContext";
import {
  CARD_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  SELECT_CLASS,
  TEXTAREA_CLASS,
  WORK_ITEM_TYPE_OPTIONS,
  WORK_ITEM_PRIORITY_OPTIONS,
  ALLOWED_PARENT_TYPES,
} from "./constants";
import type { WorkItem, WorkItemType } from "./types";
import SuggestButton from "./components/SuggestButton";

function parseUserStory(text: string): { asA: string; iWant: string; soThat: string } {
  const asA = text.match(/As a:\s*(.+)/i)?.[1]?.trim() ?? "";
  const iWant = text.match(/I want:\s*(.+)/i)?.[1]?.trim() ?? "";
  const soThat = text.match(/So that:\s*(.+)/i)?.[1]?.trim() ?? "";
  return { asA, iWant, soThat };
}

export default function WorkItemEditorPage() {
  const { currentProjectId } = useProject();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialType = (searchParams.get("type") as WorkItemType) ?? "Story";
  const initialParentId = searchParams.get("parentId") ?? "";

  const [type, setType] = useState<WorkItemType>(initialType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [asA, setAsA] = useState("");
  const [iWant, setIWant] = useState("");
  const [soThat, setSoThat] = useState("");
  const [priority, setPriority] = useState("");
  const [assignee, setAssignee] = useState("");
  const [storyPoints, setStoryPoints] = useState("");
  const [parentId, setParentId] = useState(initialParentId);
  const [parentOptions, setParentOptions] = useState<WorkItem[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const allowedParentTypes = ALLOWED_PARENT_TYPES[type];

  useEffect(() => {
    if (!currentProjectId || allowedParentTypes.length === 0) {
      setParentOptions([]);
      return;
    }
    (async () => {
      const results = await Promise.all(
        allowedParentTypes.map((t) =>
          api.get<WorkItem[]>(`/api/work-items?projectId=${currentProjectId}&type=${t}`).catch(() => []),
        ),
      );
      setParentOptions(results.flat());
    })();
  }, [currentProjectId, type]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const item = await api.post<WorkItem>("/api/work-items", {
        projectId: currentProjectId,
        type,
        title,
        description: description || null,
        asA: type === "Story" ? asA || null : null,
        iWant: type === "Story" ? iWant || null : null,
        soThat: type === "Story" ? soThat || null : null,
        priority: priority || null,
        assignee: assignee || null,
        storyPoints: type === "Story" && storyPoints ? Number(storyPoints) : null,
        parentId: parentId || null,
      });
      navigate(`/work-items/${item.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the work item.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Create Work Item</h1>

      <form onSubmit={handleSubmit} className={CARD_CLASS + " space-y-4"}>
        <div>
          <label className={LABEL_CLASS}>Type *</label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as WorkItemType);
              setParentId("");
            }}
            className={SELECT_CLASS}
          >
            {WORK_ITEM_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give it a clear title" className={INPUT_CLASS} autoFocus />
        </div>

        {allowedParentTypes.length > 0 && (
          <div>
            <label className={LABEL_CLASS}>Parent</label>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={SELECT_CLASS}>
              <option value="">No parent</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.key} — {p.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {type === "Story" ? (
          <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <label className={LABEL_CLASS}>User Story</label>
              {title.trim() && (
                <SuggestButton
                  field="userStory"
                  context={{ type, title, description }}
                  onSuggest={(text) => {
                    const parsed = parseUserStory(text);
                    setAsA(parsed.asA);
                    setIWant(parsed.iWant);
                    setSoThat(parsed.soThat);
                  }}
                />
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400 dark:text-slate-500 shrink-0">As a</span>
              <input value={asA} onChange={(e) => setAsA(e.target.value)} placeholder="customer" className={INPUT_CLASS} />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400 dark:text-slate-500 shrink-0">I want</span>
              <input value={iWant} onChange={(e) => setIWant(e.target.value)} placeholder="to make a domestic payment" className={INPUT_CLASS} />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400 dark:text-slate-500 shrink-0">So that</span>
              <input value={soThat} onChange={(e) => setSoThat(e.target.value)} placeholder="I can transfer money" className={INPUT_CLASS} />
            </div>
          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between">
            <label className={LABEL_CLASS}>Description</label>
            {title.trim() && (
              <SuggestButton field="description" context={{ type, title }} onSuggest={setDescription} />
            )}
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={TEXTAREA_CLASS} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLASS}>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={SELECT_CLASS}>
              <option value="">—</option>
              {WORK_ITEM_PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Assignee</label>
            <input value={assignee} onChange={(e) => setAssignee(e.target.value)} className={INPUT_CLASS} />
          </div>
        </div>

        {type === "Story" && (
          <div>
            <label className={LABEL_CLASS}>Story Points</label>
            <input
              type="number"
              value={storyPoints}
              onChange={(e) => setStoryPoints(e.target.value)}
              className={INPUT_CLASS + " max-w-[8rem]"}
            />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm font-medium px-3 py-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            {submitting ? "Creating…" : "Create"} <ArrowRight size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}
