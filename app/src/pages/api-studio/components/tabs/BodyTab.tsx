import { LABEL_CLASS, TEXTAREA_CLASS } from "../../constants";

export default function BodyTab({
  bodyType,
  body,
  onBodyTypeChange,
  onBodyChange,
}: {
  bodyType: "none" | "json" | "text";
  body: string;
  onBodyTypeChange: (type: "none" | "json" | "text") => void;
  onBodyChange: (body: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className={LABEL_CLASS + " mb-0"}>Body</label>
        <select
          value={bodyType}
          onChange={(e) => onBodyTypeChange(e.target.value as "none" | "json" | "text")}
          className="text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-600 dark:text-slate-300"
        >
          <option value="none">None</option>
          <option value="json">JSON</option>
          <option value="text">Text</option>
        </select>
      </div>
      {bodyType !== "none" && (
        <textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          rows={12}
          placeholder={bodyType === "json" ? '{\n  "key": "value"\n}' : "Request body"}
          className={TEXTAREA_CLASS + " font-mono text-xs"}
        />
      )}
    </div>
  );
}
