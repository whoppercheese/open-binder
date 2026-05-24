"use client";

import { CircleHelp } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type InfoTooltipProps = {
  content: string;
  label: string;
  className?: string;
};

export function InfoTooltip({ content, label, className }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        aria-label={label}
        className="relative flex size-5 shrink-0 items-center justify-center rounded-full text-zinc-500 transition before:absolute before:-inset-2 before:content-[''] hover:bg-white/5 hover:text-zinc-300"
      >
        <CircleHelp className="h-5 w-5" />
      </button>
      {open ? (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full right-0 z-10 mb-2 w-56 rounded-xl border border-white/10 bg-[#1c2030] px-3 py-2 text-xs leading-relaxed text-zinc-300 shadow-xl"
        >
          {content}
        </div>
      ) : null}
    </div>
  );
}
