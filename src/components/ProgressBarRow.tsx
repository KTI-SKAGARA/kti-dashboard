export default function ProgressBarRow({
  label,
  count,
  total,
  fillClass,
}: {
  label: string;
  count: number;
  total: number;
  fillClass: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wide text-foreground">{label}</span>
        <span className="text-muted tabular-nums">
          {count} ({pct}%)
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full rounded-full bg-border">
        <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
