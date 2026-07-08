'use client';

/**
 * Dependency-free SVG line/area chart. Scales to its container via viewBox and
 * uses currentColor so it inherits theme colours. Good enough for admin
 * dashboards without pulling a charting library (Chart.js could drop in here).
 */
export function LineChart({
  data,
  height = 160,
  color = 'hsl(var(--primary))',
}: {
  data: { date: string; count: number }[];
  height?: number;
  color?: string;
}) {
  const W = 600;
  const H = height;
  const pad = 8;
  if (data.length === 0) return <div className="text-sm text-muted-foreground">No data</div>;

  const max = Math.max(1, ...data.map((d) => d.count));
  const stepX = (W - pad * 2) / Math.max(1, data.length - 1);
  const points = data.map((d, i) => {
    const x = pad + i * stepX;
    const y = H - pad - (d.count / max) * (H - pad * 2);
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${points[points.length - 1]![0].toFixed(1)},${H - pad} L${points[0]![0].toFixed(1)},${H - pad} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.5} fill={color} />
      ))}
    </svg>
  );
}
