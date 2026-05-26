const STORAGE_KEY = "checklist-count-overrides";

export const CHECKLIST_COUNT_CHANGED_EVENT = "checklist-count-changed";

export type ChecklistCountChangedDetail = {
  cardId: string;
  count: number;
};

export function readChecklistCountOverrides(): Record<string, number> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Record<string, number> = {};
    for (const [cardId, count] of Object.entries(parsed)) {
      if (typeof count === "number" && Number.isFinite(count)) {
        result[cardId] = count;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function writeChecklistCountOverride(cardId: string, count: number) {
  if (typeof window === "undefined") {
    return;
  }

  const overrides = readChecklistCountOverrides();
  overrides[cardId] = count;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  window.dispatchEvent(
    new CustomEvent<ChecklistCountChangedDetail>(CHECKLIST_COUNT_CHANGED_EVENT, {
      detail: { cardId, count },
    }),
  );
}

export function applyChecklistCountOverrides<T extends { id: string; checklistCount?: number }>(
  cards: T[],
  overrides = readChecklistCountOverrides(),
): T[] {
  if (Object.keys(overrides).length === 0) {
    return cards;
  }

  return cards.map((card) => {
    const count = overrides[card.id];
    if (count == null) {
      return card;
    }
    return { ...card, checklistCount: count };
  });
}
