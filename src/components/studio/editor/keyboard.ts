/** True while the user is typing somewhere — editor shortcuts must stay out of the way of inputs, textareas (the canvas's text editor) and contenteditable. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    // Range/checkbox/color inputs don't take text — shortcuts can still fire over them.
    return !["range", "checkbox", "radio", "color", "button", "submit"].includes(target.type);
  }
  return false;
}

/** Cmd on macOS, Ctrl elsewhere. */
export function isPrimaryModifier(e: KeyboardEvent | WheelEvent): boolean {
  return e.metaKey || e.ctrlKey;
}

export interface ShortcutGroup {
  title: string;
  items: { keys: string[]; label: string }[];
}

/** Single source for the "?" help overlay — keep in sync with the handlers in EditorShell and CanvasArea. */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Tools",
    items: [
      { keys: ["V"], label: "Select" },
      { keys: ["P"], label: "Pen" },
      { keys: ["E"], label: "Eraser" },
      { keys: ["S"], label: "Stamp" },
      { keys: ["R"], label: "Shape" },
      { keys: ["T"], label: "Text" },
      { keys: ["F"], label: "Fill (Color mode)" },
      { keys: ["B"], label: "Brush (Color mode)" },
      { keys: ["M"], label: "Toggle mirror drawing" },
      { keys: ["[", "]"], label: "Thinner / thicker brush" },
    ],
  },
  {
    title: "Edit",
    items: [
      { keys: ["⌘/Ctrl", "Z"], label: "Undo" },
      { keys: ["⌘/Ctrl", "Shift", "Z"], label: "Redo" },
      { keys: ["⌘/Ctrl", "D"], label: "Duplicate selection" },
      { keys: ["⌘/Ctrl", "G"], label: "Group selection" },
      { keys: ["⌘/Ctrl", "Shift", "G"], label: "Ungroup" },
      { keys: ["⌘/Ctrl", "A"], label: "Select everything on the page" },
      { keys: ["Delete"], label: "Delete selection" },
      { keys: ["←", "↑", "→", "↓"], label: "Nudge 1px (Shift: 10px)" },
      { keys: ["Esc"], label: "Deselect / cancel placement" },
    ],
  },
  {
    title: "View",
    items: [
      { keys: ["⌘/Ctrl", "+"], label: "Zoom in" },
      { keys: ["⌘/Ctrl", "−"], label: "Zoom out" },
      { keys: ["⌘/Ctrl", "0"], label: "Fit page" },
      { keys: ["⌘/Ctrl", "Scroll"], label: "Zoom at pointer" },
      { keys: ["Space", "Drag"], label: "Pan" },
      { keys: ["G"], label: "Toggle print guides" },
      { keys: ["?"], label: "Show this list" },
    ],
  },
];
