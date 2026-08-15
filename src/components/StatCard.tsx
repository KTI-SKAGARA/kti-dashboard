export default function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border-2 border-border bg-surface p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 font-display text-lg font-extrabold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}