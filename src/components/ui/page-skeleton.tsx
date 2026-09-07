export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-6" aria-label="Carregando conteúdo" aria-busy="true">
      <div className="space-y-2"><div className="skeleton h-8 w-56"/><div className="skeleton h-4 w-80 max-w-full"/></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:4}).map((_,i)=><div key={i} className="rounded-lg border p-5"><div className="skeleton h-4 w-28"/><div className="skeleton mt-4 h-8 w-36"/><div className="skeleton mt-3 h-3 w-44 max-w-full"/></div>)}</div>
      <div className="rounded-lg border p-5"><div className="skeleton mb-5 h-10 w-full"/>{Array.from({length:rows}).map((_,i)=><div key={i} className="flex gap-4 border-b py-4 last:border-0"><div className="skeleton h-4 flex-1"/><div className="skeleton h-4 w-24"/><div className="skeleton h-4 w-20"/></div>)}</div>
    </div>
  );
}
