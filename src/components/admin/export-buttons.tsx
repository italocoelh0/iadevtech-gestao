import { Download } from "lucide-react";

export function ExportButtons({ baseUrl }: { baseUrl: string }) {
  const sep = baseUrl.includes("?") ? "&" : "?";
  return (
    <div className="flex flex-wrap gap-2">
      {(["xlsx", "csv", "pdf"] as const).map((format) => (
        <a key={format} href={`${baseUrl}${sep}format=${format}`} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent">
          <Download className="h-4 w-4" /> {format.toUpperCase()}
        </a>
      ))}
    </div>
  );
}
