import { INPUT_CLASS, LABEL_CLASS, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS } from "../../constants";

export default function SettingsTab({ timeoutMs, onTimeoutMsChange }: { timeoutMs: number; onTimeoutMsChange: (ms: number) => void }) {
  return (
    <div className="max-w-xs">
      <label className={LABEL_CLASS}>Timeout (ms)</label>
      <input
        type="number"
        min={MIN_TIMEOUT_MS}
        max={MAX_TIMEOUT_MS}
        value={timeoutMs}
        onChange={(e) => onTimeoutMsChange(Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Number(e.target.value) || MIN_TIMEOUT_MS)))}
        className={INPUT_CLASS}
      />
      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
        Requests are hard-capped at {MAX_TIMEOUT_MS / 1000}s by Helios's execution policy, regardless of this value.
      </p>
    </div>
  );
}
