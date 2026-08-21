import { Sun } from "lucide-react";

export default function AuthBrandHeader() {
  return (
    <div className="flex items-center gap-3.5 justify-center mb-10">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/30 flex items-center justify-center shrink-0">
        <Sun size={32} className="text-slate-950" />
      </div>
      <div className="text-left">
        <div className="text-xs tracking-[0.25em] text-slate-400 dark:text-slate-500 leading-none font-medium">
          PROJECT
        </div>
        <div className="text-3xl font-extrabold text-slate-900 dark:text-white leading-tight tracking-tight">
          HELIOS
        </div>
      </div>
    </div>
  );
}
