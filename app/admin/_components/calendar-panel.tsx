"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

export function CalendarPanel() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="cal-backdrop"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sliding panel */}
      <aside
        ref={panelRef}
        className={`cal-panel ${open ? "cal-panel--open" : ""}`}
        aria-label="Kalendarz"
      >
        <div className="cal-panel-header">
          <span className="cal-panel-title">Kalendarz</span>
          <button
            type="button"
            className="cal-panel-close"
            onClick={() => setOpen(false)}
            aria-label="Zamknij kalendarz"
          >
            ✕
          </button>
        </div>
        <div className="cal-panel-body">
          <p className="cal-placeholder">Tutaj pojawi się kalendarz.</p>
        </div>
      </aside>

      {/* FAB */}
      <button
        type="button"
        className={`cal-fab ${open ? "cal-fab--active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Otwórz kalendarz"
        aria-expanded={open}
      >
        <Image
          src="/calendar-svgrepo-com.svg"
          alt=""
          width={26}
          height={26}
          className="cal-fab-icon"
        />
      </button>

      <style>{`
        .cal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 49;
          background: rgba(0, 0, 0, 0.35);
          animation: cal-fade-in 0.18s ease;
        }

        @keyframes cal-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .cal-panel {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 380px;
          max-width: 100vw;
          z-index: 50;
          background: #161b22;
          border-left: 1px solid #30363d;
          box-shadow: -8px 0 32px rgba(0, 0, 0, 0.55);
          display: flex;
          flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .cal-panel--open {
          transform: translateX(0);
        }

        .cal-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          border-bottom: 1px solid #30363d;
          flex-shrink: 0;
        }

        .cal-panel-title {
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
          letter-spacing: 0.02em;
        }

        .cal-panel-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #8b949e;
          font-size: 16px;
          line-height: 1;
          padding: 2px 4px;
          border-radius: 4px;
          transition: color 0.15s, background 0.15s;
        }

        .cal-panel-close:hover {
          color: #ffffff;
          background: #2d3748;
        }

        .cal-panel-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px 18px;
        }

        .cal-placeholder {
          color: #8b949e;
          font-size: 13px;
          text-align: center;
          margin-top: 60px;
        }

        .cal-fab {
          position: fixed;
          bottom: 28px;
          right: 28px;
          z-index: 48;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: #d41d3c;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(212, 29, 60, 0.45);
          transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
        }

        .cal-fab:hover {
          background: #e63350;
          transform: scale(1.07);
          box-shadow: 0 6px 22px rgba(212, 29, 60, 0.6);
        }

        .cal-fab:active {
          transform: scale(0.96);
        }

        .cal-fab--active {
          background: #a31530;
          box-shadow: 0 4px 16px rgba(212, 29, 60, 0.3);
        }

        .cal-fab-icon {
          filter: brightness(0) invert(1);
          pointer-events: none;
        }
      `}</style>
    </>
  );
}
