import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ChevronRight, Loader2, Plus, Trash2, Check, Link2, X } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import {
  CARD_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  SELECT_CLASS,
  TEXTAREA_CLASS,
  WORK_ITEM_TYPE_BADGE_CLASS,
  WORK_ITEM_TYPE_LABELS,
  WORK_ITEM_STATUS_OPTIONS,
  WORK_ITEM_PRIORITY_OPTIONS,
  CHILD_TYPE_OPTIONS,
} from "./constants";
import type { AcceptanceCriterion, WorkItem, WorkItemDetail } from "./types";
import LinkTestCasesModal from "./components/LinkTestCasesModal";
import SuggestButton from "./components/SuggestButton";

export default function WorkItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<WorkItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newCriterion, setNewCriterion] = useState("");
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [generatingCriteria, setGeneratingCriteria] = useState(false);

  useEffect(() => {
    if (id) load(id);
  }, [id]);

  async function load(workItemId: string) {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<WorkItemDetail>(`/api/work-items/${workItemId}`);
      setItem(data);
      setDescriptionDraft(data.description ?? "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this work item.");
    } finally {
      setLoading(false);
    }
  }

  async function updateField(fields: Record<string, unknown>) {
    if (!item) return;
    try {
      const updated = await api.patch<WorkItem>(`/api/work-items/${item.id}`, fields);
      setItem((prev) => (prev ? { ...prev, ...updated } : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    }
  }

  async function handleDelete() {
    if (!item) return;
    if (!window.confirm(`Delete ${item.key}? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/work-items/${item.id}`);
      navigate(item.parentId ? `/work-items/${item.parentId}` : `/work-items/type/${item.type}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this work item.");
    }
  }

  async function handleAddCriterion() {
    if (!item || !newCriterion.trim()) return;
    try {
      const criterion = await api.post<AcceptanceCriterion>(`/api/work-items/${item.id}/acceptance-criteria`, {
        text: newCriterion.trim(),
      });
      setItem((prev) => (prev ? { ...prev, acceptanceCriteria: [...prev.acceptanceCriteria, criterion] } : prev));
      setNewCriterion("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add that criterion.");
    }
  }

  async function handleGenerateCriteria(text: string) {
    if (!item) return;
    const lines = text
      .split("\n")
      .map((l) => l.replace(/^[-*\d.)\s]+/, "").trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    setGeneratingCriteria(true);
    setError("");
    try {
      for (const line of lines) {
        await api.post(`/api/work-items/${item.id}/acceptance-criteria`, { text: line });
      }
      await load(item.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the generated criteria.");
    } finally {
      setGeneratingCriteria(false);
    }
  }

  async function toggleCriterion(criterion: AcceptanceCriterion) {
    if (!item) return;
    try {
      await api.patch(`/api/work-items/${item.id}/acceptance-criteria/${criterion.id}`, {
        completed: !criterion.completed,
      });
      await load(item.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update that criterion.");
    }
  }

  async function deleteCriterion(criterion: AcceptanceCriterion) {
    if (!item) return;
    try {
      await api.delete(`/api/work-items/${item.id}/acceptance-criteria/${criterion.id}`);
      await load(item.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove that criterion.");
    }
  }

  async function unlinkTestCase(testCaseId: string) {
    if (!item) return;
    try {
      await api.delete(`/api/work-items/${item.id}/test-cases/${testCaseId}`);
      await load(item.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not unlink that test case.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-10 justify-center">
        <Loader2 size={14} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-4">
        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
        <button onClick={() => navigate("/work-items/type/Epic")} className="text-sm text-blue-500 hover:underline">
          Back to Work Items
        </button>
      </div>
    );
  }

  const childTypeOptions = CHILD_TYPE_OPTIONS[item.type];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 flex-wrap">
        <button onClick={() => navigate(`/work-items/type/${item.type}`)} className="hover:text-blue-400 hover:underline">
          {WORK_ITEM_TYPE_LABELS[item.type]}s
        </button>
        {item.ancestors.map((a) => (
          <span key={a.id} className="flex items-center gap-1.5">
            <ChevronRight size={11} />
            <button onClick={() => navigate(`/work-items/${a.id}`)} className="hover:text-blue-400 hover:underline">
              {a.key}
            </button>
          </span>
        ))}
        <ChevronRight size={11} />
        <span>{item.key}</span>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${WORK_ITEM_TYPE_BADGE_CLASS[item.type]}`}>
            {item.key}
          </span>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white truncate">{item.title}</h1>
        </div>
        <button onClick={handleDelete} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-red-400 text-xs font-medium px-2 py-1.5">
          <Trash2 size={13} /> Delete
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      <div className={CARD_CLASS + " grid grid-cols-2 sm:grid-cols-4 gap-4"}>
        <div>
          <label className={LABEL_CLASS}>Status</label>
          <select value={item.status} onChange={(e) => updateField({ status: e.target.value })} className={SELECT_CLASS}>
            {WORK_ITEM_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Priority</label>
          <select value={item.priority ?? ""} onChange={(e) => updateField({ priority: e.target.value || null })} className={SELECT_CLASS}>
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
          <input
            defaultValue={item.assignee ?? ""}
            onBlur={(e) => updateField({ assignee: e.target.value || null })}
            className={INPUT_CLASS}
          />
        </div>
        {item.type === "Story" && (
          <div>
            <label className={LABEL_CLASS}>Story Points</label>
            <input
              type="number"
              defaultValue={item.storyPoints ?? ""}
              onBlur={(e) => updateField({ storyPoints: e.target.value ? Number(e.target.value) : null })}
              className={INPUT_CLASS}
            />
          </div>
        )}
      </div>

      {item.type === "Story" && (item.asA || item.iWant || item.soThat) && (
        <div className={CARD_CLASS}>
          <p className="text-sm text-slate-700 dark:text-slate-300 italic">
            As a {item.asA || "…"}, I want {item.iWant || "…"}, so that {item.soThat || "…"}.
          </p>
        </div>
      )}

      <div className={CARD_CLASS}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">Description</h2>
          <SuggestButton
            field="description"
            context={{ type: item.type, title: item.title, existingDescription: descriptionDraft }}
            onSuggest={(text) => {
              setDescriptionDraft(text);
              updateField({ description: text });
            }}
          />
        </div>
        <textarea
          value={descriptionDraft}
          onChange={(e) => setDescriptionDraft(e.target.value)}
          onBlur={(e) => updateField({ description: e.target.value || null })}
          rows={3}
          placeholder="What is this work item about?"
          className={TEXTAREA_CLASS}
        />
      </div>

      {(item.type === "Story" || item.type === "Feature") && (
        <div className={CARD_CLASS + " space-y-3"}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-900 dark:text-white">Acceptance Criteria</h2>
            <SuggestButton
              field="acceptanceCriteria"
              label={generatingCriteria ? "Generating…" : "Generate with AI"}
              context={{
                type: item.type,
                title: item.title,
                description: item.description,
                userStory: item.asA ? `As a ${item.asA}, I want ${item.iWant}, so that ${item.soThat}.` : undefined,
                existingCriteria: item.acceptanceCriteria.map((c) => c.text),
              }}
              onSuggest={handleGenerateCriteria}
            />
          </div>
          {item.acceptanceCriteria.map((c) => (
            <div key={c.id} className="flex items-center gap-2 group">
              <button
                onClick={() => toggleCriterion(c)}
                className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                  c.completed
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "border-slate-300 dark:border-slate-700"
                }`}
              >
                {c.completed && <Check size={11} />}
              </button>
              <span className={`text-sm flex-1 ${c.completed ? "line-through text-slate-400 dark:text-slate-600" : "text-slate-700 dark:text-slate-300"}`}>
                {c.text}
              </span>
              <button onClick={() => deleteCriterion(c)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 shrink-0">
                <X size={13} />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input
              value={newCriterion}
              onChange={(e) => setNewCriterion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCriterion()}
              placeholder="Add a criterion…"
              className={INPUT_CLASS}
            />
            <button onClick={handleAddCriterion} className="text-blue-500 hover:text-blue-400 shrink-0">
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}

      {item.type === "Story" && (
        <div className={CARD_CLASS + " space-y-3"}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-900 dark:text-white">Linked Test Cases</h2>
            <button
              onClick={() => setShowLinkModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-500 hover:text-blue-400"
            >
              <Link2 size={13} /> Link Test Cases
            </button>
          </div>
          {item.testCases.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500">No test cases linked yet.</p>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {item.testCases.map((tc) => (
                <div key={tc.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-700 dark:text-slate-300">
                    {tc.code} {tc.name}
                  </span>
                  <button onClick={() => unlinkTestCase(tc.id)} className="text-slate-400 hover:text-red-400">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {childTypeOptions.length > 0 && (
        <div className={CARD_CLASS + " space-y-3"}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-medium text-slate-900 dark:text-white">Child Items</h2>
            <div className="flex items-center gap-2">
              {childTypeOptions.map((t) => (
                <button
                  key={t}
                  onClick={() => navigate(`/work-items/new?type=${t}&parentId=${item.id}`)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-400"
                >
                  <Plus size={12} /> {WORK_ITEM_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          {item.children.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500">No child items yet.</p>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {item.children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => navigate(`/work-items/${child.id}`)}
                  className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-950/40"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${WORK_ITEM_TYPE_BADGE_CLASS[child.type]}`}>
                      {child.key}
                    </span>
                    <span className="text-sm text-slate-800 dark:text-slate-200 truncate">{child.title}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">{child.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showLinkModal && (
        <LinkTestCasesModal
          workItemId={item.id}
          projectId={item.projectId}
          alreadyLinkedIds={item.testCases.map((tc) => tc.id)}
          onClose={() => setShowLinkModal(false)}
          onLinked={() => load(item.id)}
        />
      )}
    </div>
  );
}
