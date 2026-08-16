import { Construction } from "lucide-react";

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6 bg-white dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
      <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-400 dark:text-slate-500">
        <Construction size={22} />
      </div>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">{title}</h2>
      <p className="text-sm text-slate-400 dark:text-slate-500 max-w-sm">
        This module is on the roadmap but not built yet. It'll go live here once its
        sprint is complete — see the product plan for sequencing.
      </p>
    </div>
  );
}
