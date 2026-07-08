'use client';

/** Dependency-free horizontal bar chart for categorical counts. */
export function BarChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return <div className="text-sm text-muted-foreground">No data</div>;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="w-40 shrink-0 truncate text-xs text-muted-foreground">{d.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-secondary">
            <div className="h-full rounded bg-primary" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="w-10 text-right text-xs tabular-nums">{d.value}</span>
        </div>
      ))}
    </div>
  );
}
