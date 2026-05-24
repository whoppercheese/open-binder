"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const SCROLL_PREFIX = "scroll:";

function shouldPreserveScroll(pathname: string) {
  return pathname === "/sets" || pathname === "/search";
}

function scrollKey(pathname: string) {
  return `${SCROLL_PREFIX}${pathname}`;
}

function saveScrollPosition(pathname: string, scrollTop: number) {
  sessionStorage.setItem(scrollKey(pathname), String(scrollTop));
}

function readScrollPosition(pathname: string) {
  const saved = sessionStorage.getItem(scrollKey(pathname));
  if (saved == null) {
    return null;
  }

  const scrollTop = Number(saved);
  return Number.isFinite(scrollTop) ? scrollTop : null;
}

export function clearSavedScrollPosition(pathname: string) {
  sessionStorage.removeItem(scrollKey(pathname));
}

export function restoreScrollPosition(pathname: string) {
  const main = document.querySelector("main.app-scroll");
  if (!(main instanceof HTMLElement) || !shouldPreserveScroll(pathname)) {
    return;
  }

  const saved = readScrollPosition(pathname);
  if (saved != null) {
    main.scrollTop = saved;
  }
}

export function scrollMainToTop() {
  const main = document.querySelector("main.app-scroll");
  if (main instanceof HTMLElement) {
    main.scrollTop = 0;
  }
}

type MobileScrollShellProps = {
  children: React.ReactNode;
};

export function MobileScrollShell({ children }: MobileScrollShellProps) {
  const mainRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  useLayoutEffect(() => {
    pathnameRef.current = pathname;

    const main = mainRef.current;
    if (!main) {
      return;
    }

    if (shouldPreserveScroll(pathname)) {
      const saved = readScrollPosition(pathname);
      main.scrollTop = saved ?? 0;
    } else {
      main.scrollTop = 0;
    }
  }, [pathname]);

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) {
      return;
    }

    let timeout: ReturnType<typeof setTimeout> | null = null;

    const saveNow = () => {
      const currentPath = pathnameRef.current;
      if (!shouldPreserveScroll(currentPath)) {
        return;
      }
      saveScrollPosition(currentPath, main.scrollTop);
    };

    const onScroll = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(saveNow, 100);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("a")) {
        saveNow();
      }
    };

    main.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClick, true);

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      main.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return (
    <main ref={mainRef} className="app-scroll min-h-0 flex-1">
      <div className="app-scroll-content pb-6">{children}</div>
    </main>
  );
}
