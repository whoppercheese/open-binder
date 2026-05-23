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
const TOUCH_MOVE_THRESHOLD = 24;

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
  const activePointerIdRef = useRef<number | null>(null);
  const gestureEndedRef = useRef(false);
  const touchEndCleanupRef = useRef<(() => void) | null>(null);
  const [showIndicator, setShowIndicator] = useState(false);

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

  const clearAllTimers = useCallback(() => {
    clearTimer();
    clearIndicatorTimer();
    if (suppressClearRef.current != null) {
      window.clearTimeout(suppressClearRef.current);
      suppressClearRef.current = null;
    }
  }, [clearIndicatorTimer, clearTimer]);

  const hideIndicator = useCallback(() => {
    setShowIndicator(false);
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

  const cancelPending = useCallback(() => {
    if (longPressFiredRef.current) return;
    clearAllTimers();
    pressingRef.current = false;
    startPosRef.current = null;
    activePointerIdRef.current = null;
    hideIndicator();
    suppressClickRef.current = false;
    indicatorShownRef.current = false;
  }, [clearAllTimers, hideIndicator]);

  const finishPress = useCallback(() => {
    if (gestureEndedRef.current) return;
    gestureEndedRef.current = true;

    clearAllTimers();

    const engaged =
      indicatorShownRef.current ||
      longPressFiredRef.current ||
      suppressClickRef.current;

    pressingRef.current = false;
    startPosRef.current = null;
    activePointerIdRef.current = null;
    hideIndicator();

    if (engaged) {
      scheduleSuppressClear();
      return;
    }

    const tapHandler = tapRef.current;
    if (tapHandler) {
      scheduleSuppressClear();
      tapHandler();
    }
  }, [clearAllTimers, hideIndicator, scheduleSuppressClear]);

  useEffect(() => {
    return () => {
      touchEndCleanupRef.current?.();
      touchEndCleanupRef.current = null;
      clearAllTimers();
    };
  }, [clearAllTimers]);

  const setRef = useCallback(
    (node: T | null) => {
      touchEndCleanupRef.current?.();
      touchEndCleanupRef.current = null;

      if (!node || disabled) return;

      const onNativeTouchEnd = (event: TouchEvent) => {
        if (
          suppressClickRef.current ||
          indicatorShownRef.current ||
          longPressFiredRef.current
        ) {
          event.preventDefault();
          event.stopPropagation();
        }

        if (
          pressingRef.current ||
          indicatorShownRef.current ||
          longPressFiredRef.current
        ) {
          finishPress();
        }
      };

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

      node.addEventListener("touchend", onNativeTouchEnd, {
        passive: false,
        capture: true,
      });
      node.addEventListener("click", blockSyntheticClick, { capture: true });

      touchEndCleanupRef.current = () => {
        node.removeEventListener("touchend", onNativeTouchEnd, {
          capture: true,
        });
        node.removeEventListener("click", blockSyntheticClick, { capture: true });
      };
    },
    [disabled, finishPress],
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

      activePointerIdRef.current = event.pointerId;
      gestureEndedRef.current = false;
      pressingRef.current = true;
      startPosRef.current = { x: event.clientX, y: event.clientY };
      clearAllTimers();
      hideIndicator();

      indicatorTimerRef.current = window.setTimeout(() => {
        indicatorTimerRef.current = null;
        if (pressingRef.current && !longPressFiredRef.current) {
          indicatorShownRef.current = true;
          suppressClickRef.current = true;
          setShowIndicator(true);
        }
      }, indicatorDelay);

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        longPressFiredRef.current = true;
        suppressClickRef.current = true;
        hideIndicator();
        callbackRef.current();
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(40);
        }
      }, totalDelay);
    },
    [
      clearAllTimers,
      disabled,
      hideIndicator,
      indicatorDelay,
      totalDelay,
    ],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (
        activePointerIdRef.current != null &&
        event.pointerId !== activePointerIdRef.current
      ) {
        return;
      }
      if (!pressingRef.current || !startPosRef.current) return;

      const threshold =
        event.pointerType === "touch" ? TOUCH_MOVE_THRESHOLD : moveThreshold;
      const dx = event.clientX - startPosRef.current.x;
      const dy = event.clientY - startPosRef.current.y;
      if (Math.hypot(dx, dy) > threshold) {
        cancelPending();
      }
    },
    [cancelPending, moveThreshold],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === "touch") return;
      if (
        activePointerIdRef.current != null &&
        event.pointerId !== activePointerIdRef.current
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      finishPress();
    },
    [finishPress],
  );

  const onPointerCancel = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      // iOS fires spurious pointercancel mid-gesture; touchend/pointerup handle release.
      if (event.pointerType === "touch") return;
      onPointerUp(event);
    },
    [onPointerUp],
  );

  const onContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;
      event.preventDefault();
    },
    [disabled],
  );

  return {
    showIndicator,
    progressDurationMs,
    ref: setRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onContextMenu,
  };
}
