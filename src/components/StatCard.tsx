export default function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}
