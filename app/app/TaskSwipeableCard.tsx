"use client";

import { useState, useRef, useEffect } from "react";
import { I } from "../admin/_lib/icons";
import { ownerInitials } from "../admin/_lib/quotes";

interface TaskSwipeableCardProps {
  task: any;
  assigneeMap: Map<string, any>;
  onMarkDone: (taskId: string) => Promise<void>;
  onStatusCycle: (taskId: string, currentStatus: string) => void;
}

export function TaskSwipeableCard({
  task,
  assigneeMap,
  onMarkDone,
  onStatusCycle,
}: TaskSwipeableCardProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isSwipingHorizontalRef = useRef<boolean | null>(null);
  const currentOffsetXRef = useRef(0);

  // Sync ref with state
  currentOffsetXRef.current = offsetX;

  const SWIPE_THRESHOLD = 90; // px to trigger done action

  // ── Touch handlers ──
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDismissing) return;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isSwipingHorizontalRef.current = null;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || isDismissing) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - startXRef.current;
    const deltaY = currentY - startYRef.current;

    // Determine direction on initial movements
    if (isSwipingHorizontalRef.current === null) {
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 6) {
        isSwipingHorizontalRef.current = true;
      } else if (Math.abs(deltaY) > 6) {
        isSwipingHorizontalRef.current = false;
      }
    }

    if (isSwipingHorizontalRef.current === true) {
      // Only allow swiping right (> 0)
      if (deltaX > 0) {
        // Resistance after 160px
        const damp = deltaX > 160 ? 160 + (deltaX - 160) * 0.3 : deltaX;
        setOffsetX(damp);
      } else {
        setOffsetX(0);
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging || isDismissing) return;
    setIsDragging(false);

    if (currentOffsetXRef.current >= SWIPE_THRESHOLD) {
      // Trigger swipe done
      setIsDismissing(true);
      setOffsetX(400); // Slide off screen right
      setTimeout(() => {
        onMarkDone(task._id);
      }, 200);
    } else {
      // Spring back to 0
      setOffsetX(0);
    }
    isSwipingHorizontalRef.current = null;
  };

  // ── Mouse handlers for desktop testing ──
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isDismissing) return;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    isSwipingHorizontalRef.current = true;
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || isDismissing) return;
    const deltaX = e.clientX - startXRef.current;
    if (deltaX > 0) {
      const damp = deltaX > 160 ? 160 + (deltaX - 160) * 0.3 : deltaX;
      setOffsetX(damp);
    } else {
      setOffsetX(0);
    }
  };

  const handleMouseUp = () => {
    if (!isDragging || isDismissing) return;
    setIsDragging(false);

    if (currentOffsetXRef.current >= SWIPE_THRESHOLD) {
      setIsDismissing(true);
      setOffsetX(400);
      setTimeout(() => {
        onMarkDone(task._id);
      }, 200);
    } else {
      setOffsetX(0);
    }
    isSwipingHorizontalRef.current = null;
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      handleMouseUp();
    }
  };

  const isDone = task.status === "done";
  const isInProgress = task.status === "in_progress";
  const swipeProgress = Math.min(1, offsetX / SWIPE_THRESHOLD);

  return (
    <div className="mobile-task-card-wrapper">
      {/* Green background revealed during right swipe */}
      <div
        className="mobile-task-swipe-bg"
        style={{
          opacity: Math.max(0.1, swipeProgress),
          backgroundColor: swipeProgress >= 1 ? "#15803d" : "#16a34a",
        }}
      >
        <div
          className="mobile-task-swipe-content"
          style={{
            transform: `scale(${0.85 + swipeProgress * 0.25})`,
            opacity: Math.min(1, swipeProgress * 1.5),
          }}
        >
          <span className="mobile-task-swipe-icon">✓</span>
          <span className="mobile-task-swipe-label">
            {swipeProgress >= 1 ? "Puść, aby wykonać!" : "Wykonane"}
          </span>
        </div>
      </div>

      {/* Main card */}
      <div
        className="mobile-task-card mobile-task-card-swipeable"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging
            ? "none"
            : "transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.22s ease",
          opacity: isDismissing ? 0 : 1,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div className="mobile-task-card-header">
          <h3
            className="mobile-task-card-title"
            style={{
              textDecoration: isDone ? "line-through" : "none",
              opacity: isDone ? 0.5 : 1,
            }}
          >
            {task.title}
          </h3>
          <button
            type="button"
            className={`mobile-status-pill status-${task.status}`}
            onClick={(e) => {
              e.stopPropagation();
              onStatusCycle(task._id, task.status);
            }}
          >
            {isDone ? "✓ DONE" : isInProgress ? "⚡ W TRAKCIE" : "○ TODO"}
          </button>
        </div>

        {task.description && (
          <div className="mobile-task-card-desc">{task.description}</div>
        )}

        {task.quote && (
          <div className="mobile-task-quote-badge">
            <I.doc s={11} />
            {task.quote.code} · {task.quote.contactName}
          </div>
        )}

        <div className="mobile-task-card-footer">
          <div className="mobile-task-meta">
            <I.cal s={11} />
            {task.dueDate
              ? new Date(task.dueDate).toLocaleDateString("pl-PL", {
                  day: "2-digit",
                  month: "short",
                })
              : "Brak terminu"}
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            {(task.assigneeIds ?? []).map((aid: string) => {
              const u = assigneeMap.get(aid);
              return u ? (
                <div
                  key={aid}
                  className="kanban-card-owner-avatar"
                  title={u.name || u.email}
                >
                  {ownerInitials(u.name || u.email)}
                </div>
              ) : null;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
