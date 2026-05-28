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
const DOUBLE_TAP_SCALE = 2.5;
const ZOOMED_THRESHOLD = 1.01;
const DOUBLE_TAP_MS = 350;
const DOUBLE_TAP_DISTANCE_PX = 40;

type Point = { x: number; y: number };

type TouchPoint = { clientX: number; clientY: number };

type Transform = {
  scale: number;
  x: number;
  y: number;
};

type GestureState = {
  mode: "idle" | "pan" | "pinch";
  startScale: number;
  startTranslate: Point;
  startFocal?: Point;
  startDistance?: number;
  lastTouch?: Point;
  moved?: boolean;
};

function getDistance(t1: TouchPoint, t2: TouchPoint) {
  return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
}

function getMidpoint(t1: TouchPoint, t2: TouchPoint): Point {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}

function focalFromPoint(point: Point, rect: DOMRect): Point {
  return {
    x: point.x - rect.left - rect.width / 2,
    y: point.y - rect.top - rect.height / 2,
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
  const [animateTransform, setAnimateTransform] = useState(false);
  const transformRef = useRef(transform);
  const isZoomedRef = useRef(false);
  const gestureRef = useRef<GestureState>({
    mode: "idle",
    startScale: 1,
    startTranslate: { x: 0, y: 0 },
  });
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const isTouchGestureRef = useRef(false);
  const lastTouchAtRef = useRef(0);

  const syncTransform = useCallback(
    (next: Transform, animated = false) => {
      transformRef.current = next;
      isZoomedRef.current = next.scale > ZOOMED_THRESHOLD;
      setAnimateTransform(animated);
      setTransform(next);
      onZoomChange?.(isZoomedRef.current);
    },
    [onZoomChange],
  );

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

  const reset = useCallback(
    (animated = false) => {
      syncTransform({ scale: 1, x: 0, y: 0 }, animated);
    },
    [syncTransform],
  );

  const zoomToPoint = useCallback(
    (clientX: number, clientY: number, targetScale: number, animated = false) => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const focal = focalFromPoint({ x: clientX, y: clientY }, rect);
      const x = focal.x * (1 - targetScale);
      const y = focal.y * (1 - targetScale);

      syncTransform(
        {
          scale: targetScale,
          ...clampTranslate(x, y, targetScale),
        },
        animated,
      );
    },
    [clampTranslate, syncTransform],
  );

  const toggleZoomAt = useCallback(
    (clientX: number, clientY: number) => {
      if (transformRef.current.scale > ZOOMED_THRESHOLD) {
        reset(true);
        return;
      }

      zoomToPoint(clientX, clientY, DOUBLE_TAP_SCALE, true);
    },
    [reset, zoomToPoint],
  );

  const registerTap = useCallback(
    (clientX: number, clientY: number) => {
      const now = Date.now();
      const lastTap = lastTapRef.current;

      if (
        lastTap &&
        now - lastTap.time < DOUBLE_TAP_MS &&
        Math.hypot(clientX - lastTap.x, clientY - lastTap.y) < DOUBLE_TAP_DISTANCE_PX
      ) {
        lastTapRef.current = null;
        toggleZoomAt(clientX, clientY);
        return true;
      }

      lastTapRef.current = { time: now, x: clientX, y: clientY };
      return false;
    },
    [toggleZoomAt],
  );

  useEffect(() => {
    transformRef.current = transform;
    isZoomedRef.current = transform.scale > ZOOMED_THRESHOLD;
  }, [transform]);

  useEffect(() => {
    if (resetRef) {
      resetRef.current = () => reset(true);
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

    return () => {
      viewport.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  const handleTouchStart = (event: React.TouchEvent) => {
    isTouchGestureRef.current = true;
    lastTouchAtRef.current = Date.now();
    setAnimateTransform(false);

    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    if (event.touches.length === 2) {
      const rect = viewport.getBoundingClientRect();
      const startFocal = focalFromPoint(
        getMidpoint(event.touches[0]!, event.touches[1]!),
        rect,
      );
      gestureRef.current = {
        mode: "pinch",
        startScale: transformRef.current.scale,
        startTranslate: {
          x: transformRef.current.x,
          y: transformRef.current.y,
        },
        startFocal,
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
        moved: false,
      };
    }
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    const gesture = gestureRef.current;
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    if (gesture.mode !== "idle") {
      setAnimateTransform(false);
    }

    if (
      gesture.mode === "pinch" &&
      event.touches.length === 2 &&
      gesture.startDistance &&
      gesture.startFocal
    ) {
      const distance = getDistance(event.touches[0]!, event.touches[1]!);
      const scale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, gesture.startScale * (distance / gesture.startDistance)),
      );
      const rect = viewport.getBoundingClientRect();
      const focal = focalFromPoint(getMidpoint(event.touches[0]!, event.touches[1]!), rect);
      const ratio = scale / gesture.startScale;
      const x = focal.x - (gesture.startFocal.x - gesture.startTranslate.x) * ratio;
      const y = focal.y - (gesture.startFocal.y - gesture.startTranslate.y) * ratio;
      syncTransform({ scale, ...clampTranslate(x, y, scale) });
      return;
    }

    if (gesture.mode === "pan" && event.touches.length === 1 && gesture.lastTouch) {
      const dx = event.touches[0]!.clientX - gesture.lastTouch.x;
      const dy = event.touches[0]!.clientY - gesture.lastTouch.y;
      if (dx !== 0 || dy !== 0) {
        gesture.moved = true;
      }
      gesture.lastTouch = {
        x: event.touches[0]!.clientX,
        y: event.touches[0]!.clientY,
      };
      const { scale, x, y } = transformRef.current;
      syncTransform({ scale, ...clampTranslate(x + dx, y + dy, scale) });
    }
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const endedMode = gestureRef.current.mode;
    const endedMoved = gestureRef.current.moved;
    const endedTouch = event.changedTouches[0];
    const isTap =
      endedMode === "idle" || (endedMode === "pan" && !endedMoved);

    if (event.touches.length === 0) {
      gestureRef.current = {
        mode: "idle",
        startScale: 1,
        startTranslate: { x: 0, y: 0 },
      };

      if (isTouchGestureRef.current && isTap && endedTouch) {
        registerTap(endedTouch.clientX, endedTouch.clientY);
      }

      isTouchGestureRef.current = false;
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
        moved: false,
      };
    }
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (Date.now() - lastTouchAtRef.current < 500) {
      return;
    }

    toggleZoomAt(event.clientX, event.clientY);
  };

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <div
      ref={viewportRef}
      className={cn("touch-none overflow-hidden select-none", className)}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        className={cn(
          "pointer-events-none size-full origin-center will-change-transform",
          animateTransform && "transition-transform duration-300 ease-out",
        )}
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
