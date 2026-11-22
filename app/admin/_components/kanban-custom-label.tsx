"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface TooltipPosition {
  left: number;
  top: number;
  maxWidth: number;
  placement: "top" | "bottom";
}

export function KanbanCustomLabel({
  text,
  disabled = false,
}: {
  text: string;
  disabled?: boolean;
}) {
  const labelRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipPosition | null>(null);

  const hide = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setTooltip(null);
  }, []);

  useEffect(() => {
    if (disabled) hide();
  }, [disabled, hide]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!tooltip) return;
    const onDismiss = () => hide();
    window.addEventListener("scroll", onDismiss, true);
    window.addEventListener("resize", onDismiss);
    window.addEventListener("pointerdown", onDismiss, true);
    return () => {
      window.removeEventListener("scroll", onDismiss, true);
      window.removeEventListener("resize", onDismiss);
      window.removeEventListener("pointerdown", onDismiss, true);
    };
  }, [tooltip, hide]);

  function handleMouseEnter() {
    if (disabled) return;
    const el = labelRef.current;
    if (!el) return;

    const isTruncated =
      el.scrollHeight > el.clientHeight + 1 ||
      el.scrollWidth > el.clientWidth + 1;
    if (!isTruncated) return;

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      const current = labelRef.current;
      if (!current) return;
      const rect = current.getBoundingClientRect();
      const viewportMargin = 12;
      const maxWidth = Math.min(320, window.innerWidth - viewportMargin * 2);
      const left = Math.max(
        viewportMargin,
        Math.min(rect.left, window.innerWidth - maxWidth - viewportMargin),
      );
      const showBelow = rect.top < 140;

      setTooltip({
        left,
        top: showBelow ? rect.bottom + 8 : rect.top - 8,
        maxWidth,
        placement: showBelow ? "bottom" : "top",
      });
    }, 150);
  }

  return (
    <>
      <div
        ref={labelRef}
        className="kanban-card-custom-label"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={hide}
        onPointerDown={hide}
      >
        {text}
      </div>
      {tooltip &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            className={`kanban-label-tooltip kanban-label-tooltip--${tooltip.placement}`}
            style={{
              left: tooltip.left,
              top: tooltip.top,
              maxWidth: tooltip.maxWidth,
            }}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}
