export default function StatCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-surface p-3.5 shadow-2xs">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      {subtext && (
        <p className="mt-0.5 text-[11px] font-medium text-muted">{subtext}</p>
      )}
    </div>
  );
}
