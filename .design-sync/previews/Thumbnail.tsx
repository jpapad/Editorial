import { Plus } from "lucide-react";
import { MetaLabel, Thumbnail } from "@pagewright/ui";

const page = (label: string) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160"><rect width="120" height="160" fill="#fff"/><circle cx="60" cy="70" r="34" fill="none" stroke="#10141a" stroke-width="3"/><path d="M42 118h36" stroke="#10141a" stroke-width="3" stroke-linecap="round"/><text x="60" y="148" font-family="Archivo, sans-serif" font-size="10" text-anchor="middle" fill="#6b7280">${label}</text></svg>`
  );

/** The page filmstrip: the selected page gets an accent ring, the last tile adds a page. */
export const Filmstrip = () => (
  <div className="flex items-end gap-3 rounded-panel bg-panel p-3 shadow-panel">
    {[1, 2, 3].map((n) => (
      <div key={n} className="flex flex-col items-center gap-1">
        <Thumbnail src={page(`Page ${n}`)} alt={`Page ${n}`} selected={n === 2} onClick={() => {}} style={{ width: 60, height: 80 }} radius="paper-sm" />
        <MetaLabel tone={n === 2 ? "ink" : "muted"}>{String(n).padStart(2, "0")}</MetaLabel>
      </div>
    ))}
    <div className="flex flex-col items-center gap-1">
      <Thumbnail dashed alt="Add page" onClick={() => {}} style={{ width: 60, height: 80, backgroundImage: "none" }} radius="paper-sm">
        <Plus size={16} className="text-ink-muted" />
      </Thumbnail>
      <MetaLabel>Add</MetaLabel>
    </div>
  </div>
);

/** Library cover with a status badge. No image yet shows the striped placeholder. */
export const BookCovers = () => (
  <div className="flex gap-4">
    <Thumbnail
      src={page("Dinosaurs")}
      alt="Dinosaurs"
      style={{ width: 120, aspectRatio: "3 / 4" }}
      badge={<span className="rounded-pill bg-accent px-2 py-0.5 text-mono font-medium uppercase tracking-[0.09em] text-white">Draft</span>}
    />
    <Thumbnail alt="Untitled" style={{ width: 120, aspectRatio: "3 / 4" }} />
  </div>
);
