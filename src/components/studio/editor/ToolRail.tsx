import { MousePointer2, PenTool, Eraser, Square, Type, Sticker, PaintBucket, Sparkles } from "lucide-react";
import { cn } from "@/utils/cn";
import type { EditorMode } from "@/components/studio/types";
import type { DrawingTool } from "@/types/editor";

export interface ToolRailProps {
  mode: EditorMode;
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onAiClick?: () => void;
  aiActive?: boolean;
}

interface ToolDef {
  id: DrawingTool;
  icon: typeof MousePointer2;
  label: string;
}

/**
 * Real tool set now (this shell hosts the actual Konva canvas, not a
 * layout-only demo) — confirmed decision: extend the rail rather than
 * force the old editor's 6 draw tools into the mock's original 4-slot
 * budget. AI is the one item that isn't mode-specific, always last, past
 * the hairline (per "Mode switch Draw / Color / Assemble drives the
 * whole editor: tool rail contents..." — README, Interactions &
 * behavior). Assemble mode has no canvas tools of its own — page actions
 * (add/reorder) live in the filmstrip, matching how the old editor's
 * PageManager already worked, so its rail is just the AI item.
 */
const DRAW_TOOLS: ToolDef[] = [
  { id: "select", icon: MousePointer2, label: "Select" },
  { id: "pen", icon: PenTool, label: "Pen" },
  { id: "eraser", icon: Eraser, label: "Eraser" },
  { id: "stamp", icon: Sticker, label: "Stamp" },
  { id: "shape", icon: Square, label: "Shape" },
  { id: "text", icon: Type, label: "Text" },
];

const TOOLS_BY_MODE: Record<EditorMode, ToolDef[]> = {
  draw: DRAW_TOOLS,
  color: [
    { id: "select", icon: MousePointer2, label: "Select" },
    { id: "fill", icon: PaintBucket, label: "Fill" },
  ],
  assemble: [],
  // The cover is drawn with the same tools as a page.
  cover: DRAW_TOOLS,
};

function ToolButton({ tool, active, onClick }: { tool: ToolDef; active: boolean; onClick: () => void }) {
  const Icon = tool.icon;
  return (
    <button
      type="button"
      aria-label={tool.label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-row-sm outline-none transition-colors duration-150 motion-reduce:transition-none",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        active ? "bg-accent text-white" : "bg-inset-alt text-icon-idle hover:bg-inset"
      )}
    >
      <Icon size={18} strokeWidth={2} />
    </button>
  );
}

export default function ToolRail({ mode, activeTool, onToolChange, onAiClick, aiActive = false }: ToolRailProps) {
  const tools = TOOLS_BY_MODE[mode];

  return (
    <nav aria-label="Tools" className="absolute left-[18px] top-[106px] flex w-16 flex-col items-center gap-1.5 rounded-rail bg-panel py-3 shadow-panel">
      {tools.map((tool) => (
        <ToolButton key={tool.id} tool={tool} active={activeTool === tool.id} onClick={() => onToolChange(tool.id)} />
      ))}

      {tools.length > 0 && <div className="mx-auto my-1 h-px w-[26px] bg-hairline" />}

      <button
        type="button"
        aria-label="AI and import"
        aria-pressed={aiActive}
        title="AI & import: sketch cleanup, page series, AI stamps"
        onClick={onAiClick}
        className={cn(
          "flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-row-sm outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
          aiActive ? "bg-accent text-white" : "bg-accent-tint text-accent"
        )}
      >
        <Sparkles size={16} strokeWidth={2} />
        <span className="text-[7px] font-medium uppercase tracking-[0.09em]">AI</span>
      </button>
    </nav>
  );
}
