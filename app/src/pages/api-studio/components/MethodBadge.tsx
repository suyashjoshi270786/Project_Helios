import { METHOD_BADGE_CLASS } from "../constants";
import type { HttpMethod } from "../types";

export default function MethodBadge({ method, compact = false }: { method: HttpMethod; compact?: boolean }) {
  return (
    <span
      className={`inline-block font-medium rounded-full shrink-0 text-center ${METHOD_BADGE_CLASS[method]} ${
        compact ? "text-[9px] px-1.5 py-0.5 w-11" : "text-[11px] px-2 py-0.5 w-16"
      }`}
    >
      {method}
    </span>
  );
}
