"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseLongPressOptions = {
  /** Hold time after the indicator appears before the action fires. */
  holdDuration?: number;
  /** Debounce before the indicator appears; added on top of holdDuration. */
  indicatorDelay?: number;
  moveThreshold?: number;
  disabled?: boolean;
  /** Short tap handler — invoked from pointerup, not from click (needed for iOS). */
  onTap?: () => void;
};

const CLICK_SUPPRESS_MS = 500;
const DEFAULT_HOLD_DURATION = 1000;
const DEFAULT_INDICATOR_DELAY = 200;

export function useLongPress<T extends HTMLElement = HTMLElement>(
  onLongPress: () => void,
  {
    holdDuration = DEFAULT_HOLD_DURATION,
    indicatorDelay = DEFAULT_INDICATOR_DELAY,
    moveThreshold = 10,
    disabled = false,
    onTap,
  }: UseLongPressOptions = {},
) {
  const callbackRef = useRef(onLongPress);
  const tapRef = useRef(onTap);
  const timerRef = useRef<number | null>(null);
  const indicatorTimerRef = useRef<number | null>(null);
  const suppressClearRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressFiredRef = useRef(false);
  const suppressClickRef = useRef(false);
  const indicatorShownRef = useRef(false);
  const pressingRef = useRef(false);
  const touchEndCleanupRef = useRef<(() => void) | null>(null);
  const [isPending, setIsPending] = useState(false);

  const totalDelay = indicatorDelay + holdDuration;
  const progressDurationMs = holdDuration;

  callbackRef.current = onLongPress;
  tapRef.current = onTap;

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearIndicatorTimer = useCallback(() => {
    if (indicatorTimerRef.current != null) {
      window.clearTimeout(indicatorTimerRef.current);
      indicatorTimerRef.current = null;
    }
  }, []);

  const scheduleSuppressClear = useCallback(() => {
    if (suppressClearRef.current != null) {
      window.clearTimeout(suppressClearRef.current);
    }
    suppressClickRef.current = true;
    suppressClearRef.current = window.setTimeout(() => {
      longPressFiredRef.current = false;
      suppressClickRef.current = false;
      indicatorShownRef.current = false;
      suppressClearRef.current = null;
    }, CLICK_SUPPRESS_MS);
  }, []);

  const cancelPending = useCallback(
    (options?: { keepClickSuppress?: boolean }) => {
      if (longPressFiredRef.current) return;
      clearTimer();
      clearIndicatorTimer();
      pressingRef.current = false;
      startPosRef.current = null;
      setIsPending(false);
      if (!options?.keepClickSuppress) {
        suppressClickRef.current = false;
        indicatorShownRef.current = false;
      }
    },
    [clearIndicatorTimer, clearTimer],
  );

  useEffect(() => {
    return () => {
      touchEndCleanupRef.current?.();
      touchEndCleanupRef.current = null;
    };
  }, []);

  const setRef = useCallback(
    (node: T | null) => {
      touchEndCleanupRef.current?.();
      touchEndCleanupRef.current = null;

      if (!node || disabled) return;

      const blockSyntheticClick = (event: Event) => {
        if (
          suppressClickRef.current ||
          indicatorShownRef.current ||
          longPressFiredRef.current
        ) {
          event.preventDefault();
          event.stopPropagation();
        }
      };

      node.addEventListener("touchend", blockSyntheticClick, {
        passive: false,
        capture: true,
      });
      node.addEventListener("click", blockSyntheticClick, { capture: true });

      touchEndCleanupRef.current = () => {
        node.removeEventListener("touchend", blockSyntheticClick, {
          capture: true,
        });
        node.removeEventListener("click", blockSyntheticClick, { capture: true });
      };
    },
    [disabled],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (disabled || event.button !== 0) return;

      longPressFiredRef.current = false;
      suppressClickRef.current = false;
      indicatorShownRef.current = false;
      if (suppressClearRef.current != null) {
        window.clearTimeout(suppressClearRef.current);
        suppressClearRef.current = null;
      }

      pressingRef.current = true;
      startPosRef.current = { x: event.clientX, y: event.clientY };
      clearTimer();
      clearIndicatorTimer();
      setIsPending(false);

      indicatorTimerRef.current = window.setTimeout(() => {
        indicatorTimerRef.current = null;
        if (pressingRef.current && !longPressFiredRef.current) {
          indicatorShownRef.current = true;
          suppressClickRef.current = true;
          setIsPending(true);
        }
      }, indicatorDelay);

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        longPressFiredRef.current = true;
        suppressClickRef.current = true;
        setIsPending(false);
        callbackRef.current();
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(40);
        }
      }, totalDelay);
    },
    [clearIndicatorTimer, clearTimer, disabled, indicatorDelay, totalDelay],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!pressingRef.current || !startPosRef.current) return;

      const dx = event.clientX - startPosRef.current.x;
      const dy = event.clientY - startPosRef.current.y;
      if (Math.hypot(dx, dy) > moveThreshold) {
        cancelPending({
          keepClickSuppress:
            indicatorShownRef.current || suppressClickRef.current,
        });
      }
    },
    [cancelPending, moveThreshold],
  );

  const endPress = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      clearTimer();
      clearIndicatorTimer();

      const engaged =
        indicatorShownRef.current ||
        longPressFiredRef.current ||
        suppressClickRef.current;

      pressingRef.current = false;
      startPosRef.current = null;
      setIsPending(false);

      event.preventDefault();
      event.stopPropagation();

      if (engaged) {
        scheduleSuppressClear();
        return;
      }

      const tapHandler = tapRef.current;
      if (tapHandler) {
        scheduleSuppressClear();
        tapHandler();
      }
    },
    [clearIndicatorTimer, clearTimer, scheduleSuppressClear],
  );

  const onContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;
      event.preventDefault();
    },
    [disabled],
  );

  const onPointerLeave = useCallback(() => {
    cancelPending({
      keepClickSuppress: indicatorShownRef.current || suppressClickRef.current,
    });
  }, [cancelPending]);

  return {
    isPending,
    progressDurationMs,
    ref: setRef,
    onPointerDown,
    onPointerMove,
    onPointerUp: endPress,
    onPointerCancel: endPress,
    onPointerLeave,
    onContextMenu,
  };
}
