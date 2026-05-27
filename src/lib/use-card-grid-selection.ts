"use client";

import { useCallback, useMemo, useRef, useState } from "react";

const SUPPRESS_TOGGLE_AFTER_ENTER_MS = 500;

export function useCardGridSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const suppressToggleRef = useRef(false);

  const shouldIgnoreTap = useCallback(() => suppressToggleRef.current, []);

  const isSelecting = selectedIds.size > 0;
  const selectedCount = selectedIds.size;

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  const enterWith = useCallback((id: string) => {
    suppressToggleRef.current = true;
    setSelectedIds(new Set([id]));
    window.setTimeout(() => {
      suppressToggleRef.current = false;
    }, SUPPRESS_TOGGLE_AFTER_ENTER_MS);
  }, []);

  const toggle = useCallback((id: string) => {
    if (suppressToggleRef.current) {
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return useMemo(
    () => ({
      isSelecting,
      selectedIds,
      selectedCount,
      isSelected,
      enterWith,
      toggle,
      clear,
      shouldIgnoreTap,
    }),
    [
      isSelecting,
      selectedIds,
      selectedCount,
      isSelected,
      enterWith,
      toggle,
      clear,
      shouldIgnoreTap,
    ],
  );
}
