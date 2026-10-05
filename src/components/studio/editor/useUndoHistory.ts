"use client";

import { useRef, useState } from "react";

/**
 * Undo/redo by full snapshots. `current` is the state now (cloned when a
 * step is recorded); `restore` puts a snapshot back. Call `push()` just
 * before each change that should be one undo step.
 */
export function useUndoHistory<T>(current: T, restore: (snapshot: T) => void, max = 50) {
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  function push() {
    pastRef.current = [...pastRef.current, structuredClone(current)].slice(-max);
    futureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }

  function undo() {
    const previous = pastRef.current.at(-1);
    if (previous === undefined) return;
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, structuredClone(current)].slice(-max);
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(true);
    restore(previous);
  }

  function redo() {
    const next = futureRef.current.at(-1);
    if (next === undefined) return;
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, structuredClone(current)].slice(-max);
    setCanRedo(futureRef.current.length > 0);
    setCanUndo(true);
    restore(next);
  }

  /** Forget every step (e.g. after loading a different project). */
  function clear() {
    pastRef.current = [];
    futureRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }

  return { push, undo, redo, clear, canUndo, canRedo };
}
