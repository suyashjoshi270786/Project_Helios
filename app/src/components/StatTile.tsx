export default function StatTile({
  label,
  value,
  icon: Icon,
  tint,
  onClick,
  title,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size?: number }>;
  tint: string;
  onClick?: () => void;
  title?: string;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      title={title}
      className={`flex-1 min-w-[110px] text-left bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-3 transition-colors ${
        onClick ? "cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`w-6 h-6 rounded-md flex items-center justify-center ${tint}`}>
          <Icon size={12} />
        </span>
      </div>
      <div className="text-xl font-semibold text-slate-900 dark:text-white tabular-nums">{value}</div>
    </Wrapper>
  );
}
