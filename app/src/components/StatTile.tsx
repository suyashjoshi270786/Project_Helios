export default function StatTile({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size?: number }>;
  tint: string;
}) {
  return (
    <div className="flex-1 min-w-[110px] bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`w-6 h-6 rounded-md flex items-center justify-center ${tint}`}>
          <Icon size={12} />
        </span>
      </div>
      <div className="text-xl font-semibold text-slate-900 dark:text-white tabular-nums">{value}</div>
    </div>
  );
}
