export function ReportBar({ label, value, max, suffix }: { label: string; value: number; max: number; suffix?: string }) {
  const width = max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between gap-4 text-sm"><span>{label}</span><span className="font-medium">{value.toLocaleString("pt-BR")}{suffix ?? ""}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} /></div>
    </div>
  );
}
