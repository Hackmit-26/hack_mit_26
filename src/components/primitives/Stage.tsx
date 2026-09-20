"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Renders a fixed-size artboard and scales it to fit the viewport.
 *
 * The cards are drawn at exact pixel sizes (1440×1000 desktop, 390×844
 * mobile), so scaling the whole stage keeps every proportion identical to the
 * design at any window size — and nothing reflows, so there are no layout
 * jumps between cards.
 */
export function Stage({
  width,
  height,
  children,
  /** Never enlarge past 1:1 unless asked; big monitors shouldn't blur it. */
  maxScale = 1,
  padding = 0,
  className,
}: {
  width: number;
  height: number;
  children: ReactNode;
  maxScale?: number;
  padding?: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const measure = () => {
      const rect = host.getBoundingClientRect();
      const available = {
        w: Math.max(rect.width - padding * 2, 1),
        h: Math.max(rect.height - padding * 2, 1),
      };
      const next = Math.min(available.w / width, available.h / height, maxScale);
      setScale(next > 0 ? next : 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    window.addEventListener("orientationchange", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", measure);
    };
  }, [width, height, maxScale, padding]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width,
          height,
          flexShrink: 0,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** True once the viewport is narrower than the design's mobile breakpoint. */
export function useIsMobile(breakpoint = 720): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [breakpoint]);

  return isMobile;
}
