"use client";

import { useCallback, useRef, useState } from "react";

type UseLongPressOptions = {
  /** Hold time after the indicator appears before the action fires. */
  holdDuration?: number;
  /** Debounce before the indicator appears; added on top of holdDuration. */
  indicatorDelay?: number;
  moveThreshold?: number;
  disabled?: boolean;
};

const CLICK_SUPPRESS_MS = 500;
const DEFAULT_HOLD_DURATION = 1000;
const DEFAULT_INDICATOR_DELAY = 200;

export function useLongPress(
  onLongPress: () => void,
  {
    holdDuration = DEFAULT_HOLD_DURATION,
    indicatorDelay = DEFAULT_INDICATOR_DELAY,
    moveThreshold = 10,
    disabled = false,
  }: UseLongPressOptions = {},
) {
  const callbackRef = useRef(onLongPress);
  const timerRef = useRef<number | null>(null);
  const indicatorTimerRef = useRef<number | null>(null);
  const suppressClearRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressFiredRef = useRef(false);
  const suppressClickRef = useRef(false);
  const pressingRef = useRef(false);
  const [isPending, setIsPending] = useState(false);

  const totalDelay = indicatorDelay + holdDuration;
  const progressDurationMs = holdDuration;

  callbackRef.current = onLongPress;

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
    suppressClearRef.current = window.setTimeout(() => {
      longPressFiredRef.current = false;
      suppressClickRef.current = false;
      suppressClearRef.current = null;
    }, CLICK_SUPPRESS_MS);
  }, []);

  const cancelPending = useCallback(() => {
    if (longPressFiredRef.current) return;
    clearTimer();
    clearIndicatorTimer();
    pressingRef.current = false;
    startPosRef.current = null;
    setIsPending(false);
    suppressClickRef.current = false;
  }, [clearIndicatorTimer, clearTimer]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (disabled || event.button !== 0) return;

      longPressFiredRef.current = false;
      suppressClickRef.current = false;
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
        cancelPending();
      }
    },
    [cancelPending, moveThreshold],
  );

  const endPress = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      clearTimer();
      clearIndicatorTimer();
      const shouldSuppressClick = suppressClickRef.current;
      pressingRef.current = false;
      startPosRef.current = null;
      setIsPending(false);

      if (shouldSuppressClick) {
        event.preventDefault();
        scheduleSuppressClear();
      }
    },
    [clearIndicatorTimer, clearTimer, scheduleSuppressClear],
  );

  const bindClick = useCallback((handler?: () => void) => {
    return (event: React.MouseEvent<HTMLElement>) => {
      if (suppressClickRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      handler?.();
    };
  }, []);

  const onContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;
      event.preventDefault();
    },
    [disabled],
  );

  return {
    isPending,
    progressDurationMs,
    onPointerDown,
    onPointerMove,
    onPointerUp: endPress,
    onPointerCancel: endPress,
    onPointerLeave: cancelPending,
    onContextMenu,
    bindClick,
  };
}
