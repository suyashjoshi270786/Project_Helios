import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { api, ApiError } from "../../../lib/api";
import type { SuggestField } from "../types";

export default function SuggestButton({
  field,
  context,
  onSuggest,
  compact,
}: {
  field: SuggestField;
  context: Record<string, unknown>;
  onSuggest: (text: string) => void;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setLoading(true);
    setError("");
    try {
      const { suggestion } = await api.post<{ suggestion: string }>(
        "/api/test-plans/suggest",
        { field, context },
        30000,
      );
      onSuggest(suggestion);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate a suggestion.");
    } finally {
      setLoading(false);
    }
  }

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          title="Suggest with AI"
          className="shrink-0 text-blue-500 hover:text-blue-400 disabled:opacity-50 p-1.5"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        </button>
        {error && <span className="text-[10px] text-red-500 dark:text-red-400">{error}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        title="Suggest with AI"
        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-400 disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
        Suggest with AI
      </button>
      {error && <span className="text-[11px] text-red-500 dark:text-red-400">{error}</span>}
    </span>
  );
}
