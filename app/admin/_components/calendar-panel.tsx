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
const HOUR_HEIGHT = 58; // px per hour slot

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

function formatDurationLabel(startStr: string, endStr: string): string {
  const diff = parseHour(endStr) - parseHour(startStr);
  if (diff <= 0) return "Nieprawidłowy czas";
  const hours = Math.floor(diff);
  const mins = Math.round((diff - hours) * 60);
  if (hours > 0 && mins > 0) return `${hours} godz. ${mins} min`;
  if (hours > 0) return `${hours} godz.`;
  return `${mins} min`;
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

// ─── Sliding Drawer for Add / Edit Event ─────────────────────────────────────

function EventDrawer({
  isOpen,
  form,
  setForm,
  selectedDate,
  onSave,
  onDelete,
  onCancel,
  saving,
}: {
  isOpen: boolean;
  form: FormState;
  setForm: (f: FormState) => void;
  selectedDate: CalendarDate;
  onSave: () => void;
  onDelete?: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const timeOptions = HOURS.flatMap((h) => [
    `${String(h).padStart(2, "0")}:00`,
    `${String(h).padStart(2, "0")}:30`,
  ]).concat(["17:00"]);

  const durationText = formatDurationLabel(form.startTime, form.endTime);

  return (
    <div className={`cal-drawer ${isOpen ? "cal-drawer--open" : ""}`}>
      {/* Header */}
      <div className="cal-drawer-header">
        <div className="cal-drawer-header-top">
          <button
            type="button"
            className="cal-drawer-back"
            onClick={onCancel}
            title="Powrót do kalendarza"
          >
            ← Powrót
          </button>
          <span className="cal-drawer-mode-badge">
            {form.mode === "create" ? "Nowe wydarzenie" : "Edycja wydarzenia"}
          </span>
        </div>
        <div className="cal-drawer-date-pill">
          📅 {formatDateLabel(selectedDate)}
        </div>
      </div>

      {/* Body cards */}
      <div className="cal-drawer-body">
        {/* Card 1: Tytuł i opis */}
        <div className="cal-card">
          <div className="cal-card-title">Informacje podstawowe</div>
          <div className="cal-form-group">
            <label className="cal-label">Tytuł wydarzenia *</label>
            <input
              type="text"
              className="cal-input"
              placeholder="np. Spotkanie z inwestorem, Wizyta na budowie..."
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              autoFocus
            />
          </div>
          <div className="cal-form-group" style={{ marginTop: 12 }}>
            <label className="cal-label">Opis / Notatki</label>
            <textarea
              className="cal-textarea"
              placeholder="Dodatkowe informacje (opcjonalnie)..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        {/* Card 2: Godziny */}
        <div className="cal-card">
          <div className="cal-card-title-row">
            <span className="cal-card-title">Czas trwania</span>
            <span className="cal-duration-chip">⏱ {durationText}</span>
          </div>
          <div className="cal-time-row">
            <div className="cal-time-col">
              <label className="cal-label">Początek</label>
              <select
                className="cal-select"
                value={form.startTime}
                onChange={(e) => {
                  const newStart = e.target.value;
                  let newEnd = form.endTime;
                  if (parseHour(newStart) >= parseHour(newEnd)) {
                    const nextHourIdx = timeOptions.indexOf(newStart) + 2;
                    newEnd = timeOptions[Math.min(nextHourIdx, timeOptions.length - 1)];
                  }
                  setForm({ ...form, startTime: newStart, endTime: newEnd });
                }}
              >
                {timeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <span className="cal-time-arrow">→</span>
            <div className="cal-time-col">
              <label className="cal-label">Koniec</label>
              <select
                className="cal-select"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              >
                {timeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Card 3: Kolor */}
        <div className="cal-card">
          <div className="cal-card-title">Kolor oznaczenia</div>
          <div className="cal-color-grid">
            {EVENT_COLORS.map((c) => {
              const active = form.color === c.hex;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`cal-color-card ${active ? "is-active" : ""}`}
                  onClick={() => setForm({ ...form, color: c.hex })}
                >
                  <span
                    className="cal-color-swatch"
                    style={{ background: c.hex }}
                  >
                    {active && <span className="cal-color-check">✓</span>}
                  </span>
                  <span className="cal-color-name">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer bar */}
      <div className="cal-drawer-footer">
        {form.mode === "edit" && onDelete ? (
          <button
            type="button"
            className="cal-btn cal-btn--danger"
            onClick={onDelete}
            disabled={saving}
          >
            Usuń
          </button>
        ) : (
          <div />
        )}
        <div className="cal-drawer-footer-right">
          <button
            type="button"
            className="cal-btn cal-btn--ghost"
            onClick={onCancel}
            disabled={saving}
          >
            Anuluj
          </button>
          <button
            type="button"
            className="cal-btn cal-btn--primary"
            onClick={onSave}
            disabled={saving || !form.title.trim()}
          >
            {saving ? "Zapisywanie…" : "Zapisz wydarzenie"}
          </button>
        </div>
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
  onAddClick,
}: {
  selectedDate: CalendarDate;
  events: CalEvent[];
  onSlotClick: (hour: number) => void;
  onEventClick: (event: CalEvent) => void;
  onAddClick: () => void;
}) {
  return (
    <div className="cal-day-view">
      <div className="cal-day-header">
        <div className="cal-day-header-title">{formatDateLabel(selectedDate)}</div>
        <button
          type="button"
          className="cal-day-add-btn"
          onClick={onAddClick}
        >
          + Dodaj
        </button>
      </div>

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
          const height = Math.max((endH - startH) * HOUR_HEIGHT, 28);
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
                background: `${color}1e`,
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<CalendarDate>(
    today(getLocalTimeZone()),
  );
  const [form, setForm] = useState<FormState>({
    mode: "create",
    title: "",
    description: "",
    startTime: "09:00",
    endTime: "10:00",
    color: EVENT_COLORS[0].hex,
  });
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
        if (isDrawerOpen) {
          setIsDrawerOpen(false);
        } else {
          setOpen(false);
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isDrawerOpen]);

  function handleSlotClick(hour: number) {
    setForm({
      mode: "create",
      title: "",
      description: "",
      startTime: `${String(hour).padStart(2, "0")}:00`,
      endTime: `${String(Math.min(hour + 1, 17)).padStart(2, "0")}:00`,
      color: EVENT_COLORS[0].hex,
    });
    setIsDrawerOpen(true);
  }

  function handleAddHeaderClick() {
    setForm({
      mode: "create",
      title: "",
      description: "",
      startTime: "09:00",
      endTime: "10:00",
      color: EVENT_COLORS[0].hex,
    });
    setIsDrawerOpen(true);
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
    setIsDrawerOpen(true);
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
      setIsDrawerOpen(false);
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
      setIsDrawerOpen(false);
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
          onClick={() => { setIsDrawerOpen(false); setOpen(false); }}
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
          <span className="cal-panel-title">Mój kalendarz</span>
          <button
            type="button"
            className="cal-panel-close"
            onClick={() => { setIsDrawerOpen(false); setOpen(false); }}
            aria-label="Zamknij kalendarz"
          >
            ✕
          </button>
        </div>

        <div className="cal-panel-body">
          {/* ─── Month View (react-aria) ──────────────────────────────── */}
          <Calendar
            value={selectedDate}
            onChange={(d) => { setSelectedDate(d); setIsDrawerOpen(false); }}
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
            onAddClick={handleAddHeaderClick}
          />
        </div>

        {/* ─── Sliding Secondary Drawer for Add / Edit Event ────────── */}
        <EventDrawer
          isOpen={isDrawerOpen}
          form={form}
          setForm={setForm}
          selectedDate={selectedDate}
          onSave={handleSave}
          onDelete={form.mode === "edit" ? handleDelete : undefined}
          onCancel={() => setIsDrawerOpen(false)}
          saving={saving}
        />
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
        /* ─── Typography & Container (Geist Sans / Modern Sans) ──── */
        .cal-panel,
        .cal-drawer,
        .cal-panel * {
          font-family: var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          box-sizing: border-box;
          -webkit-font-smoothing: antialiased;
        }

        /* ─── Backdrop & Panel ────────────────────────────────────── */
        .cal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 49;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(2px);
          animation: cal-fade-in 0.2s ease;
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
          width: 400px;
          max-width: 100vw;
          z-index: 50;
          background: #111419;
          border-left: 1px solid #282e37;
          box-shadow: -10px 0 36px rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }

        .cal-panel--open {
          transform: translateX(0);
        }

        .cal-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #21262d;
          flex-shrink: 0;
          background: #13171d;
        }

        .cal-panel-title {
          font-size: 15px;
          font-weight: 600;
          color: #f0f6fc;
          letter-spacing: -0.01em;
        }

        .cal-panel-close {
          background: #1d2229;
          border: 1px solid #30363d;
          cursor: pointer;
          color: #8b949e;
          font-size: 14px;
          line-height: 1;
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: color 0.15s, background 0.15s, border-color 0.15s;
        }

        .cal-panel-close:hover {
          color: #ffffff;
          background: #2d3748;
          border-color: #444c56;
        }

        .cal-panel-body {
          flex: 1;
          overflow-y: auto;
          padding: 18px 0;
          position: relative;
        }

        /* ─── Month Calendar (react-aria) ─────────────────────────── */
        .cal-month {
          display: block;
          padding: 0 20px 18px;
        }

        .cal-month-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .cal-month-heading {
          font-size: 15px;
          font-weight: 600;
          color: #f0f6fc;
          text-align: center;
          letter-spacing: -0.01em;
        }

        .cal-month-nav {
          background: #181d24;
          border: 1px solid #30363d;
          color: #c9d1d9;
          cursor: pointer;
          width: 32px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          font-size: 11px;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }

        .cal-month-nav:hover {
          background: #262c36;
          color: #ffffff;
          border-color: #444c56;
        }

        .cal-month-grid {
          width: 100%;
          border-collapse: collapse;
        }

        .cal-month-day-header {
          font-size: 11px;
          font-weight: 600;
          color: #7d8590;
          text-align: center;
          padding: 6px 0 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .cal-month-cell {
          text-align: center;
          padding: 1px 0;
        }

        .cal-month-cell > span,
        .cal-month-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          margin: 0 auto;
          border-radius: 9px;
          font-size: 13.5px;
          font-weight: 500;
          color: #c9d1d9;
          cursor: pointer;
          transition: background 0.15s, color 0.15s, transform 0.1s;
          border: none;
          background: transparent;
          outline: none;
        }

        .cal-month-cell[data-hovered] {
          background: #222832;
          color: #ffffff;
        }

        .cal-month-cell[data-selected] {
          background: linear-gradient(135deg, #7a1024, #d41d3c);
          color: #ffffff;
          font-weight: 600;
          box-shadow: 0 2px 10px rgba(212, 29, 60, 0.45);
        }

        .cal-month-cell[data-focused] {
          outline: 2px solid #d41d3c;
          outline-offset: -2px;
        }

        .cal-month-cell[data-outside-month] {
          color: #484f58;
          font-weight: 400;
        }

        .cal-month-cell[data-disabled] {
          color: #30363d;
          cursor: default;
        }

        /* ─── Day View ────────────────────────────────────────────── */
        .cal-day-view {
          border-top: 1px solid #21262d;
        }

        .cal-day-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          border-bottom: 1px solid #21262d;
          background: #14181f;
        }

        .cal-day-header-title {
          font-size: 13.5px;
          font-weight: 600;
          color: #e6edf3;
          letter-spacing: -0.01em;
        }

        .cal-day-add-btn {
          background: rgba(212, 29, 60, 0.15);
          color: #ff7b90;
          border: 1px solid rgba(212, 29, 60, 0.35);
          font-size: 12px;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .cal-day-add-btn:hover {
          background: #d41d3c;
          color: #ffffff;
          border-color: #d41d3c;
        }

        .cal-day-grid {
          position: relative;
          margin: 0 20px;
        }

        .cal-hour-slot {
          position: absolute;
          left: 0;
          right: 0;
          border-bottom: 1px solid #1f242c;
          cursor: pointer;
          transition: background 0.12s;
          display: flex;
          align-items: flex-start;
        }

        .cal-hour-slot:hover {
          background: rgba(255, 255, 255, 0.025);
        }

        .cal-hour-label {
          position: sticky;
          top: 0;
          font-size: 11.5px;
          font-weight: 500;
          color: #7d8590;
          width: 50px;
          flex-shrink: 0;
          padding: 6px 0;
          user-select: none;
        }

        /* ─── Event Blocks ────────────────────────────────────────── */
        .cal-event-block {
          position: absolute;
          left: 54px;
          right: 4px;
          border-radius: 7px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-left: 4px solid #d41d3c;
          padding: 5px 10px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
          text-align: left;
          transition: all 0.15s;
          z-index: 2;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        }

        .cal-event-block:hover {
          filter: brightness(1.18);
          transform: translateY(-1px);
        }

        .cal-event-time {
          font-size: 11px;
          color: #c9d1d9;
          font-weight: 600;
        }

        .cal-event-title {
          font-size: 13px;
          color: #ffffff;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ─── Sliding Drawer (Add / Edit Event) ─────────────────────── */
        .cal-drawer {
          position: absolute;
          inset: 0;
          z-index: 20;
          background: #111419;
          display: flex;
          flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
          pointer-events: none;
          opacity: 0;
        }

        .cal-drawer--open {
          transform: translateX(0);
          pointer-events: auto;
          opacity: 1;
        }

        .cal-drawer-header {
          padding: 16px 20px 14px;
          border-bottom: 1px solid #21262d;
          background: #14181f;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .cal-drawer-header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .cal-drawer-back {
          background: none;
          border: none;
          color: #8b949e;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          padding: 4px 8px 4px 0;
          transition: color 0.15s;
        }

        .cal-drawer-back:hover {
          color: #ffffff;
        }

        .cal-drawer-mode-badge {
          font-size: 11.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #ff7b90;
          background: rgba(212, 29, 60, 0.15);
          padding: 3px 9px;
          border-radius: 999px;
          border: 1px solid rgba(212, 29, 60, 0.3);
        }

        .cal-drawer-date-pill {
          font-size: 14px;
          font-weight: 600;
          color: #f0f6fc;
        }

        .cal-drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .cal-card {
          background: #161b22;
          border: 1px solid #282e37;
          border-radius: 10px;
          padding: 16px;
        }

        .cal-card-title {
          font-size: 12px;
          font-weight: 600;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 12px;
        }

        .cal-card-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .cal-card-title-row .cal-card-title {
          margin-bottom: 0;
        }

        .cal-duration-chip {
          font-size: 11.5px;
          font-weight: 600;
          color: #7d8590;
          background: #1d222b;
          padding: 3px 8px;
          border-radius: 6px;
        }

        .cal-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .cal-label {
          font-size: 12px;
          font-weight: 500;
          color: #c9d1d9;
        }

        .cal-input,
        .cal-textarea,
        .cal-select {
          width: 100%;
          padding: 9px 12px;
          font-size: 13.5px;
          color: #ffffff;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 7px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .cal-input:focus,
        .cal-textarea:focus,
        .cal-select:focus {
          border-color: #d41d3c;
          box-shadow: 0 0 0 2px rgba(212, 29, 60, 0.2);
        }

        .cal-textarea {
          resize: vertical;
          min-height: 64px;
        }

        .cal-time-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .cal-time-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .cal-time-arrow {
          color: #7d8590;
          font-weight: 600;
          padding-top: 20px;
        }

        .cal-color-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .cal-color-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          background: #10141a;
          border: 1px solid #282e37;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
        }

        .cal-color-card:hover {
          background: #181d24;
          border-color: #38414e;
        }

        .cal-color-card.is-active {
          background: #1c222b;
          border-color: #f0f6fc;
        }

        .cal-color-swatch {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .cal-color-check {
          font-size: 11px;
          color: #ffffff;
          font-weight: 800;
          line-height: 1;
        }

        .cal-color-name {
          font-size: 12.5px;
          color: #e6edf3;
          font-weight: 500;
        }

        /* ─── Drawer Footer ───────────────────────────────────────── */
        .cal-drawer-footer {
          padding: 14px 20px;
          border-top: 1px solid #21262d;
          background: #14181f;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .cal-drawer-footer-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .cal-btn {
          padding: 8px 16px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
        }

        .cal-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .cal-btn--primary {
          background: linear-gradient(135deg, #7a1024, #d41d3c);
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(212, 29, 60, 0.4);
        }

        .cal-btn--primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #8c1329, #e63350);
          box-shadow: 0 4px 14px rgba(212, 29, 60, 0.6);
        }

        .cal-btn--ghost {
          background: transparent;
          color: #8b949e;
          border: 1px solid #30363d;
        }

        .cal-btn--ghost:hover:not(:disabled) {
          background: #222730;
          color: #ffffff;
        }

        .cal-btn--danger {
          background: transparent;
          color: #f85149;
          border: 1px solid rgba(248, 81, 73, 0.35);
        }

        .cal-btn--danger:hover:not(:disabled) {
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
          box-shadow: 0 4px 18px rgba(212, 29, 60, 0.5);
          transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
        }

        .cal-fab:hover {
          background: #e63350;
          transform: scale(1.06);
          box-shadow: 0 6px 24px rgba(212, 29, 60, 0.65);
        }

        .cal-fab:active {
          transform: scale(0.95);
        }

        .cal-fab--active {
          background: #a31530;
          box-shadow: 0 4px 16px rgba(212, 29, 60, 0.35);
        }

        .cal-fab-icon {
          filter: brightness(0) invert(1);
          pointer-events: none;
        }
      `}</style>
    </>
  );
}
