"use client";

import { useTranslations } from "@/lib/i18n/context";
import {
  cn,
  conditionBadgeClassName,
  CONDITION_I18N_KEYS,
  normalizeLegacyCondition,
  type CardCondition,
} from "@/lib/utils";

type ConditionBadgeProps = {
  condition: CardCondition | string;
  size?: "sm" | "md";
  selected?: boolean;
  className?: string;
};

export function ConditionBadge({
  condition,
  size = "sm",
  selected = false,
  className,
}: ConditionBadgeProps) {
  const t = useTranslations();
  const resolved = normalizeLegacyCondition(condition);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border font-semibold tracking-wide",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        resolved
          ? conditionBadgeClassName(resolved, { selected })
          : "border-white/10 bg-white/5 text-zinc-400",
        className,
      )}
    >
      {resolved
        ? t(CONDITION_I18N_KEYS[resolved])
        : t("common.unknown")}
    </span>
  );
}

type ConditionBadgeButtonProps = {
  condition: CardCondition;
  selected?: boolean;
  size?: "sm" | "md";
  className?: string;
  onClick?: () => void;
};

export function ConditionBadgeButton({
  condition,
  selected = false,
  size = "md",
  className,
  onClick,
}: ConditionBadgeButtonProps) {
  const t = useTranslations();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl border font-semibold tracking-wide transition",
        size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm",
        conditionBadgeClassName(condition, { selected }),
        !selected && "hover:brightness-110",
        className,
      )}
    >
      {t(CONDITION_I18N_KEYS[condition])}
    </button>
  );
}
