import { Braces } from "lucide-react";

export default function ApiStudioEmptyState() {
  return (
    <div className="text-center py-16 text-sm text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
      <Braces size={22} className="text-slate-300 dark:text-slate-700" />
      Select a request from the sidebar, or create a new one to get started.
    </div>
  );
}
