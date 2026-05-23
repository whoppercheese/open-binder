"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "@/lib/utils";

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOMED_THRESHOLD = 1.01;

type Point = { x: number; y: number };

type Transform = {
  scale: number;
  x: number;
  y: number;
};

type GestureState = {
  mode: "idle" | "pan" | "pinch";
  startScale: number;
  startTranslate: Point;
  startDistance?: number;
  lastTouch?: Point;
};

function getDistance(t1: Touch, t2: Touch) {
  return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
}

function getMidpoint(t1: Touch, t2: Touch): Point {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}

function focalFromTouch(touch: Touch, rect: DOMRect): Point {
  return {
    x: touch.clientX - rect.left - rect.width / 2,
    y: touch.clientY - rect.top - rect.height / 2,
  };
}

type LightboxZoomViewportProps = {
  children: ReactNode;
  className?: string;
  onZoomChange?: (zoomed: boolean) => void;
  resetRef?: RefObject<(() => void) | null>;
};

export function LightboxZoomViewport({
  children,
  className,
  onZoomChange,
  resetRef,
}: LightboxZoomViewportProps) {
  const [transform, setTransform] = useState<Transform>({
    scale: 1,
    x: 0,
    y: 0,
  });
  const transformRef = useRef(transform);
  const gestureRef = useRef<GestureState>({
    mode: "idle",
    startScale: 1,
    startTranslate: { x: 0, y: 0 },
  });
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef(0);

  const syncTransform = useCallback((next: Transform) => {
    transformRef.current = next;
    setTransform(next);
    onZoomChange?.(next.scale > ZOOMED_THRESHOLD);
  }, [onZoomChange]);

  const clampTranslate = useCallback(
    (x: number, y: number, scale: number): Point => {
      const viewport = viewportRef.current;
      if (!viewport || scale <= MIN_SCALE) {
        return { x: 0, y: 0 };
      }

      const maxX = (viewport.clientWidth * (scale - 1)) / 2;
      const maxY = (viewport.clientHeight * (scale - 1)) / 2;

      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [],
  );

  const reset = useCallback(() => {
    syncTransform({ scale: 1, x: 0, y: 0 });
  }, [syncTransform]);

  useEffect(() => {
    if (resetRef) {
      resetRef.current = reset;
    }
  }, [reset, resetRef]);

  useEffect(() => {
    onZoomChange?.(false);
  }, [onZoomChange]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const onTouchMove = (event: TouchEvent) => {
      if (gestureRef.current.mode !== "idle") {
        event.preventDefault();
      }
    };

    viewport.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => viewport.removeEventListener("touchmove", onTouchMove);
  }, []);

  const handleTouchStart = (event: React.TouchEvent) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    if (event.touches.length === 2) {
      gestureRef.current = {
        mode: "pinch",
        startScale: transformRef.current.scale,
        startTranslate: {
          x: transformRef.current.x,
          y: transformRef.current.y,
        },
        startDistance: getDistance(event.touches[0]!, event.touches[1]!),
      };
      return;
    }

    if (event.touches.length === 1 && transformRef.current.scale > ZOOMED_THRESHOLD) {
      gestureRef.current = {
        mode: "pan",
        startScale: transformRef.current.scale,
        startTranslate: {
          x: transformRef.current.x,
          y: transformRef.current.y,
        },
        lastTouch: {
          x: event.touches[0]!.clientX,
          y: event.touches[0]!.clientY,
        },
      };
    }
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    const gesture = gestureRef.current;
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    if (gesture.mode === "pinch" && event.touches.length === 2 && gesture.startDistance) {
      const distance = getDistance(event.touches[0]!, event.touches[1]!);
      const scale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, gesture.startScale * (distance / gesture.startDistance)),
      );
      const rect = viewport.getBoundingClientRect();
      const focal = focalFromTouch(getMidpoint(event.touches[0]!, event.touches[1]!), rect);
      const ratio = scale / gesture.startScale;
      const x = focal.x - (focal.x - gesture.startTranslate.x) * ratio;
      const y = focal.y - (focal.y - gesture.startTranslate.y) * ratio;
      syncTransform({ scale, ...clampTranslate(x, y, scale) });
      return;
    }

    if (gesture.mode === "pan" && event.touches.length === 1 && gesture.lastTouch) {
      const dx = event.touches[0]!.clientX - gesture.lastTouch.x;
      const dy = event.touches[0]!.clientY - gesture.lastTouch.y;
      gesture.lastTouch = {
        x: event.touches[0]!.clientX,
        y: event.touches[0]!.clientY,
      };
      const { scale, x, y } = transformRef.current;
      syncTransform({ scale, ...clampTranslate(x + dx, y + dy, scale) });
    }
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (event.touches.length === 0) {
      if (transformRef.current.scale <= ZOOMED_THRESHOLD) {
        reset();
      }
      gestureRef.current = {
        mode: "idle",
        startScale: 1,
        startTranslate: { x: 0, y: 0 },
      };
      return;
    }

    if (event.touches.length === 1 && transformRef.current.scale > ZOOMED_THRESHOLD) {
      gestureRef.current = {
        mode: "pan",
        startScale: transformRef.current.scale,
        startTranslate: {
          x: transformRef.current.x,
          y: transformRef.current.y,
        },
        lastTouch: {
          x: event.touches[0]!.clientX,
          y: event.touches[0]!.clientY,
        },
      };
    }
  };

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();

    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      reset();
      lastTapRef.current = 0;
      return;
    }

    lastTapRef.current = now;
  };

  return (
    <div
      ref={viewportRef}
      className={cn("touch-none overflow-hidden", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onClick={handleClick}
    >
      <div
        className="size-full origin-center will-change-transform"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
