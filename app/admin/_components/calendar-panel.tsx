"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import {
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarHeading,
  Button,
} from "react-aria-components";
import {
  today,
  getLocalTimeZone,
  type CalendarDate,
} from "@internationalized/date";

// ─── Constants ────────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 9 }, (_, i) => i + 8); // 8..16
const HOUR_HEIGHT = 54; // px per hour slot

const EVENT_COLORS = [
  { id: "red", hex: "#d41d3c", label: "Czerwony" },
  { id: "blue", hex: "#3b82f6", label: "Niebieski" },
  { id: "green", hex: "#22a06b", label: "Zielony" },
  { id: "amber", hex: "#d97706", label: "Pomarańczowy" },
  { id: "purple", hex: "#8b5cf6", label: "Fioletowy" },
  { id: "cyan", hex: "#06b6d4", label: "Turkusowy" },
];

const POLISH_DAYS = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
const POLISH_MONTHS = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];

function formatDateLabel(d: CalendarDate): string {
  const jsDate = new Date(d.year, d.month - 1, d.day);
  const dayName = POLISH_DAYS[jsDate.getDay()];
  return `${dayName}, ${d.day} ${POLISH_MONTHS[d.month - 1]} ${d.year}`;
}

function dateToString(d: CalendarDate): string {
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

function parseHour(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h + (m || 0) / 60;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CalEvent = {
  _id: Id<"calendarEvents">;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  color?: string;
  createdBy: Id<"users">;
  createdAt: number;
};

type FormState = {
  mode: "create" | "edit";
  eventId?: Id<"calendarEvents">;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  color: string;
};

// ─── Event Form ───────────────────────────────────────────────────────────────

function EventForm({
  form,
  setForm,
  onSave,
  onDelete,
  onCancel,
  saving,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  onSave: () => void;
  onDelete?: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const timeOptions = HOURS.flatMap((h) => [
    `${String(h).padStart(2, "0")}:00`,
    `${String(h).padStart(2, "0")}:30`,
  ]).concat(["17:00"]);

  return (
    <div className="cal-event-form">
      <div className="cal-form-field">
        <input
          type="text"
          className="cal-form-input"
          placeholder="Tytuł wydarzenia…"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          autoFocus
        />
      </div>

      <div className="cal-form-field">
        <textarea
          className="cal-form-textarea"
          placeholder="Opis (opcjonalnie)…"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
        />
      </div>

      <div className="cal-form-row">
        <div className="cal-form-field cal-form-half">
          <label className="cal-form-label">Od</label>
          <select
            className="cal-form-select"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          >
            {timeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="cal-form-field cal-form-half">
          <label className="cal-form-label">Do</label>
          <select
            className="cal-form-select"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
          >
            {timeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="cal-form-field">
        <label className="cal-form-label">Kolor</label>
        <div className="cal-color-picker">
          {EVENT_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`cal-color-dot${form.color === c.hex ? " is-active" : ""}`}
              style={{ background: c.hex }}
              title={c.label}
              onClick={() => setForm({ ...form, color: c.hex })}
            />
          ))}
        </div>
      </div>

      <div className="cal-form-actions">
        {form.mode === "edit" && onDelete && (
          <button
            type="button"
            className="cal-form-btn cal-form-btn--danger"
            onClick={onDelete}
            disabled={saving}
          >
            Usuń
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="cal-form-btn cal-form-btn--ghost"
          onClick={onCancel}
          disabled={saving}
        >
          Anuluj
        </button>
        <button
          type="button"
          className="cal-form-btn cal-form-btn--primary"
          onClick={onSave}
          disabled={saving || !form.title.trim()}
        >
          {saving ? "…" : "Zapisz"}
        </button>
      </div>
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({
  selectedDate,
  events,
  onSlotClick,
  onEventClick,
}: {
  selectedDate: CalendarDate;
  events: CalEvent[];
  onSlotClick: (hour: number) => void;
  onEventClick: (event: CalEvent) => void;
}) {
  return (
    <div className="cal-day-view">
      <div className="cal-day-header">{formatDateLabel(selectedDate)}</div>
      <div className="cal-day-grid" style={{ height: HOURS.length * HOUR_HEIGHT }}>
        {/* Hour lines */}
        {HOURS.map((h) => (
          <div
            key={h}
            className="cal-hour-slot"
            style={{ top: (h - 8) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
            onClick={() => onSlotClick(h)}
          >
            <span className="cal-hour-label">
              {String(h).padStart(2, "0")}:00
            </span>
          </div>
        ))}

        {/* Events */}
        {events.map((ev) => {
          const startH = parseHour(ev.startTime);
          const endH = parseHour(ev.endTime);
          const top = (startH - 8) * HOUR_HEIGHT;
          const height = Math.max((endH - startH) * HOUR_HEIGHT, 24);
          const color = ev.color || EVENT_COLORS[0].hex;

          return (
            <button
              key={ev._id}
              type="button"
              className="cal-event-block"
              style={{
                top,
                height,
                borderLeftColor: color,
                background: `${color}22`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onEventClick(ev);
              }}
            >
              <span className="cal-event-time">
                {ev.startTime}–{ev.endTime}
              </span>
              <span className="cal-event-title">{ev.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main CalendarPanel ───────────────────────────────────────────────────────

export function CalendarPanel() {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<CalendarDate>(
    today(getLocalTimeZone()),
  );
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const dateStr = dateToString(selectedDate);
  const events = useQuery(api.calendarEvents.listByDate, { date: dateStr });

  const createEvent = useMutation(api.calendarEvents.create);
  const updateEvent = useMutation(api.calendarEvents.update);
  const removeEvent = useMutation(api.calendarEvents.remove);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (form) {
          setForm(null);
        } else {
          setOpen(false);
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [form]);

  function handleSlotClick(hour: number) {
    setForm({
      mode: "create",
      title: "",
      description: "",
      startTime: `${String(hour).padStart(2, "0")}:00`,
      endTime: `${String(hour + 1).padStart(2, "0")}:00`,
      color: EVENT_COLORS[0].hex,
    });
  }

  function handleEventClick(ev: CalEvent) {
    setForm({
      mode: "edit",
      eventId: ev._id,
      title: ev.title,
      description: ev.description || "",
      startTime: ev.startTime,
      endTime: ev.endTime,
      color: ev.color || EVENT_COLORS[0].hex,
    });
  }

  async function handleSave() {
    if (!form || !form.title.trim()) return;
    setSaving(true);
    try {
      if (form.mode === "create") {
        await createEvent({
          title: form.title,
          description: form.description || undefined,
          date: dateStr,
          startTime: form.startTime,
          endTime: form.endTime,
          color: form.color,
        });
        toast.success("Wydarzenie dodane");
      } else if (form.eventId) {
        await updateEvent({
          id: form.eventId,
          title: form.title,
          description: form.description || null,
          startTime: form.startTime,
          endTime: form.endTime,
          color: form.color,
        });
        toast.success("Wydarzenie zaktualizowane");
      }
      setForm(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Błąd zapisu");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!form?.eventId) return;
    setSaving(true);
    try {
      await removeEvent({ id: form.eventId });
      toast.success("Wydarzenie usunięte");
      setForm(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Błąd usuwania");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="cal-backdrop"
          onClick={() => { setForm(null); setOpen(false); }}
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
            onClick={() => { setForm(null); setOpen(false); }}
            aria-label="Zamknij kalendarz"
          >
            ✕
          </button>
        </div>

        <div className="cal-panel-body">
          {/* ─── Month View (react-aria) ──────────────────────────────── */}
          <Calendar
            value={selectedDate}
            onChange={(d) => { setSelectedDate(d); setForm(null); }}
            aria-label="Wybierz datę"
            className="cal-month"
          >
            <header className="cal-month-header">
              <Button slot="previous" className="cal-month-nav">◀</Button>
              <CalendarHeading className="cal-month-heading" />
              <Button slot="next" className="cal-month-nav">▶</Button>
            </header>
            <CalendarGrid className="cal-month-grid">
              <CalendarGridHeader>
                {(day) => (
                  <CalendarHeaderCell className="cal-month-day-header">
                    {day}
                  </CalendarHeaderCell>
                )}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => <CalendarCell date={date} className="cal-month-cell" />}
              </CalendarGridBody>
            </CalendarGrid>
          </Calendar>

          {/* ─── Day View ────────────────────────────────────────────── */}
          <DayView
            selectedDate={selectedDate}
            events={(events ?? []) as CalEvent[]}
            onSlotClick={handleSlotClick}
            onEventClick={handleEventClick}
          />

          {/* ─── Event Form ──────────────────────────────────────────── */}
          {form && (
            <EventForm
              form={form}
              setForm={setForm}
              onSave={handleSave}
              onDelete={form.mode === "edit" ? handleDelete : undefined}
              onCancel={() => setForm(null)}
              saving={saving}
            />
          )}
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
        /* ─── Backdrop & Panel ────────────────────────────────────── */
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
          padding: 16px 0;
        }

        /* ─── Month Calendar (react-aria) ─────────────────────────── */
        .cal-month {
          display: block;
          padding: 0 18px 16px;
        }

        .cal-month-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .cal-month-heading {
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
          text-align: center;
        }

        .cal-month-nav {
          background: none;
          border: 1px solid #30363d;
          color: #c9d1d9;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
          transition: background 0.15s, color 0.15s;
        }

        .cal-month-nav:hover {
          background: #2d3748;
          color: #ffffff;
        }

        .cal-month-grid {
          width: 100%;
          border-collapse: collapse;
        }

        .cal-month-day-header {
          font-size: 11px;
          font-weight: 600;
          color: #8b949e;
          text-align: center;
          padding: 4px 0 8px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .cal-month-cell {
          text-align: center;
          padding: 0;
        }

        .cal-month-cell > span,
        .cal-month-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          margin: 1px auto;
          border-radius: 8px;
          font-size: 13px;
          color: #c9d1d9;
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
          border: none;
          background: none;
          outline: none;
        }

        .cal-month-cell[data-hovered] {
          background: #2d3748;
          color: #ffffff;
        }

        .cal-month-cell[data-selected] {
          background: linear-gradient(135deg, #7a1024, #d41d3c);
          color: #ffffff;
          font-weight: 600;
        }

        .cal-month-cell[data-focused] {
          outline: 2px solid #d41d3c;
          outline-offset: -2px;
        }

        .cal-month-cell[data-outside-month] {
          color: #484f58;
        }

        .cal-month-cell[data-disabled] {
          color: #30363d;
          cursor: default;
        }

        .cal-month-cell[data-unavailable] {
          color: #30363d;
          cursor: default;
        }

        /* ─── Day View ────────────────────────────────────────────── */
        .cal-day-view {
          border-top: 1px solid #30363d;
          margin-top: 4px;
        }

        .cal-day-header {
          padding: 12px 18px;
          font-size: 13px;
          font-weight: 600;
          color: #c9d1d9;
          border-bottom: 1px solid #21262d;
          letter-spacing: 0.01em;
        }

        .cal-day-grid {
          position: relative;
          margin: 0 18px;
        }

        .cal-hour-slot {
          position: absolute;
          left: 0;
          right: 0;
          border-bottom: 1px solid #21262d;
          cursor: pointer;
          transition: background 0.12s;
          display: flex;
          align-items: flex-start;
        }

        .cal-hour-slot:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .cal-hour-label {
          position: sticky;
          top: 0;
          font-size: 11px;
          color: #8b949e;
          width: 48px;
          flex-shrink: 0;
          padding: 4px 0;
          user-select: none;
        }

        /* ─── Event Blocks ────────────────────────────────────────── */
        .cal-event-block {
          position: absolute;
          left: 52px;
          right: 4px;
          border-radius: 6px;
          border: none;
          border-left: 3px solid #d41d3c;
          padding: 4px 8px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 1px;
          overflow: hidden;
          text-align: left;
          transition: filter 0.12s;
          z-index: 1;
        }

        .cal-event-block:hover {
          filter: brightness(1.2);
        }

        .cal-event-time {
          font-size: 10px;
          color: #c9d1d9;
          font-weight: 500;
        }

        .cal-event-title {
          font-size: 12px;
          color: #ffffff;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ─── Event Form ──────────────────────────────────────────── */
        .cal-event-form {
          border-top: 1px solid #30363d;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          animation: cal-slide-up 0.18s ease;
        }

        @keyframes cal-slide-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .cal-form-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .cal-form-row {
          display: flex;
          gap: 10px;
        }

        .cal-form-half {
          flex: 1;
        }

        .cal-form-label {
          font-size: 11px;
          font-weight: 600;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .cal-form-input,
        .cal-form-textarea,
        .cal-form-select {
          width: 100%;
          padding: 7px 10px;
          font-size: 13px;
          color: #ffffff;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          outline: none;
          font-family: inherit;
          transition: border-color 0.15s;
        }

        .cal-form-input:focus,
        .cal-form-textarea:focus,
        .cal-form-select:focus {
          border-color: #d41d3c;
        }

        .cal-form-textarea {
          resize: vertical;
          min-height: 48px;
        }

        .cal-form-select {
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Cpath d='M2 4l4 4 4-4' fill='none' stroke='%238b949e' stroke-width='1.5'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 8px center;
          padding-right: 28px;
        }

        .cal-color-picker {
          display: flex;
          gap: 8px;
          padding: 2px 0;
        }

        .cal-color-dot {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: border-color 0.12s, transform 0.12s;
        }

        .cal-color-dot:hover {
          transform: scale(1.15);
        }

        .cal-color-dot.is-active {
          border-color: #ffffff;
          box-shadow: 0 0 0 1px rgba(0,0,0,0.3);
        }

        .cal-form-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
        }

        .cal-form-btn {
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: background 0.12s, opacity 0.12s;
        }

        .cal-form-btn:disabled {
          opacity: 0.5;
          cursor: default;
        }

        .cal-form-btn--primary {
          background: linear-gradient(135deg, #7a1024, #d41d3c);
          color: #ffffff;
        }

        .cal-form-btn--primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #8a1228, #e63350);
        }

        .cal-form-btn--ghost {
          background: transparent;
          color: #8b949e;
          border: 1px solid #30363d;
        }

        .cal-form-btn--ghost:hover:not(:disabled) {
          background: #2d3748;
          color: #ffffff;
        }

        .cal-form-btn--danger {
          background: transparent;
          color: #f85149;
          border: 1px solid rgba(248, 81, 73, 0.3);
        }

        .cal-form-btn--danger:hover:not(:disabled) {
          background: rgba(248, 81, 73, 0.15);
        }

        /* ─── FAB ─────────────────────────────────────────────────── */
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
