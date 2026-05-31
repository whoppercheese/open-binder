"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeLegacyCondition, type CardCondition } from "@/lib/utils";

export function useDefaultCondition() {
  const [defaultCondition, setDefaultCondition] = useState<CardCondition>("nm");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/settings");
    if (!response.ok) return;

    const data = (await response.json()) as { defaultCondition?: string };
    if (data.defaultCondition) {
      const normalized = normalizeLegacyCondition(data.defaultCondition);
      if (normalized) {
        setDefaultCondition(normalized);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }

    document.addEventListener("visibilitychange", handleVisible);
    return () => document.removeEventListener("visibilitychange", handleVisible);
  }, [refresh]);

  return { defaultCondition, refresh };
}
