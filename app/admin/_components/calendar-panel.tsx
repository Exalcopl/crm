"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ownerInitials } from "../_lib/quotes";
import { UserFilterBar } from "./user-filter-bar";
import { getUserColor } from "../_lib/users";
import { Building2, CalendarDays, CheckSquare, Plus } from "lucide-react";

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

const USER_PALETTE = [
  "#d41d3c", // Czerwony
  "#3b82f6", // Niebieski
  "#22a06b", // Zielony
  "#d97706", // Pomarańczowy
  "#8b5cf6", // Fioletowy
  "#06b6d4", // Turkusowy
];

type CategoryStyle = { id: string; label: string; color: string; bg: string; border: string };

function hexToRgba(hex: string, alpha: number): string {
  try {
    const cleanHex = hex.replace("#", "");
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch {
    return `rgba(156, 163, 175, ${alpha})`;
  }
}

function getPolishHoliday(year: number, month: number, day: number): string | null {
  if (month === 1 && day === 1) return "Nowy Rok";
  if (month === 1 && day === 6) return "Trzech Króli";
  if (month === 5 && day === 1) return "Święto Pracy";
  if (month === 5 && day === 3) return "Święto Konstytucji 3 Maja";
  if (month === 8 && day === 15) return "Wniebowzięcie NMP / Wojska Polskiego";
  if (month === 11 && day === 1) return "Wszystkich Świętych";
  if (month === 11 && day === 11) return "Święto Niepodległości";
  if (month === 12 && day === 25) return "Boże Narodzenie";
  if (month === 12 && day === 26) return "Boże Narodzenie (drugi dzień)";

  const a = year % 19;
  const b = year % 4;
  const c = year % 7;
  const d = (19 * a + 24) % 30;
  const e = (2 * b + 4 * c + 6 * d + 5) % 7;
  let easterDay = 22 + d + e;
  let easterMonth = 3;
  if (easterDay > 31) {
    easterDay = d + e - 9;
    if (easterDay === 26) easterDay = 19;
    if (easterDay === 25 && d === 28 && e === 6 && a > 10) easterDay = 18;
    easterMonth = 4;
  }

  const easter = new Date(Date.UTC(year, easterMonth - 1, easterDay));

  const easterMonday = new Date(easter);
  easterMonday.setUTCDate(easter.getUTCDate() + 1);

  const bozeCialo = new Date(easter);
  bozeCialo.setUTCDate(easter.getUTCDate() + 60);

  const zieloneSwiatki = new Date(easter);
  zieloneSwiatki.setUTCDate(easter.getUTCDate() + 49);

  const queryDate = new Date(Date.UTC(year, month - 1, day));

  const compare = (d1: Date, d2: Date) =>
    d1.getUTCFullYear() === d2.getUTCFullYear() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCDate() === d2.getUTCDate();

  if (compare(queryDate, easter)) return "Niedziela Wielkanocna";
  if (compare(queryDate, easterMonday)) return "Poniedziałek Wielkanocny";
  if (compare(queryDate, zieloneSwiatki)) return "Zielone Świątki";
  if (compare(queryDate, bozeCialo)) return "Boże Ciało";

  return null;
}

const FALLBACK_CATEGORY: CategoryStyle = {
  id: "inne", label: "Inne", color: "#9ca3af",
  bg: "rgba(156, 163, 175, 0.12)", border: "rgba(156, 163, 175, 0.3)",
};

const POLISH_DAYS = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
const POLISH_MONTHS = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];

function formatWeekRangeLabel(startStr: string, endStr: string): string {
  const [y1, m1, d1] = startStr.split("-").map(Number);
  const [y2, m2, d2] = endStr.split("-").map(Number);
  
  if (y1 === y2 && m1 === m2) {
    return `${d1} - ${d2} ${POLISH_MONTHS[m1 - 1]} ${y1}`;
  }
  if (y1 === y2) {
    return `${d1} ${POLISH_MONTHS[m1 - 1]} - ${d2} ${POLISH_MONTHS[m2 - 1]} ${y1}`;
  }
  return `${d1} ${POLISH_MONTHS[m1 - 1]} ${y1} - ${d2} ${POLISH_MONTHS[m2 - 1]} ${y2}`;
}

function shiftWeek(d: CalendarDate, weeks: number): CalendarDate {
  const jsDate = new Date(d.year, d.month - 1, d.day);
  jsDate.setDate(jsDate.getDate() + weeks * 7);
  return {
    year: jsDate.getFullYear(),
    month: jsDate.getMonth() + 1,
    day: jsDate.getDate(),
    calendar: d.calendar,
    era: d.era,
    copy() { return this; }
  } as CalendarDate;
}

function getTodayCalendarDate(centerDate: CalendarDate): CalendarDate {
  const jsDate = new Date();
  return {
    year: jsDate.getFullYear(),
    month: jsDate.getMonth() + 1,
    day: jsDate.getDate(),
    calendar: centerDate.calendar,
    era: centerDate.era,
    copy() { return this; }
  } as CalendarDate;
}

function getWeekDateStrings(centerDate: CalendarDate): string[] {
  const jsDate = new Date(centerDate.year, centerDate.month - 1, centerDate.day);
  const day = jsDate.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(jsDate);
  monday.setDate(jsDate.getDate() + diff);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return dates;
}

const POLISH_DAYS_SHORT = ["Niedz", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];
const POLISH_MONTHS_SHORT = [
  "sty", "lut", "mar", "kwi", "maj", "cze",
  "lip", "sie", "wrz", "paź", "lis", "gru",
];

function formatWeekDayHeader(dateStr: string): { dayName: string; dateNum: number; monthName: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const jsDate = new Date(y, m - 1, d);
  const dayName = POLISH_DAYS_SHORT[jsDate.getDay()] || "";
  const monthName = POLISH_MONTHS_SHORT[m - 1] || "";
  return { dayName, dateNum: d, monthName };
}

function getMonthGridDays(centerDate: CalendarDate): string[] {
  const year = centerDate.year;
  const month = centerDate.month;
  
  const firstDay = new Date(year, month - 1, 1);
  const startDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const offsetToMonday = startDayOfWeek === 0 ? -6 : 1 - startDayOfWeek;
  
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() + offsetToMonday);
  
  const dates: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return dates;
}

function shiftMonth(d: CalendarDate, months: number): CalendarDate {
  const jsDate = new Date(d.year, d.month - 1 + months, 1);
  return {
    year: jsDate.getFullYear(),
    month: jsDate.getMonth() + 1,
    day: 1,
    calendar: d.calendar,
    era: d.era,
    copy() { return this; }
  } as CalendarDate;
}

function formatMonthLabel(d: CalendarDate): string {
  return `${POLISH_MONTHS[d.month - 1].toUpperCase()} ${d.year}`;
}

function formatDateLabel(d?: CalendarDate): string {
  if (!d) return "";
  const jsDate = new Date(d.year, d.month - 1, d.day);
  const dayName = POLISH_DAYS[jsDate.getDay()] || "";
  return `${dayName}, ${d.day} ${POLISH_MONTHS[d.month - 1] || ""} ${d.year}`;
}

function dateToString(d?: CalendarDate): string {
  if (!d) return "";
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

function parseHour(timeStr?: string): number {
  if (!timeStr || typeof timeStr !== "string" || !timeStr.includes(":")) return 9;
  const parts = timeStr.split(":");
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  return h + m / 60;
}

function formatHour(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function formatDurationLabel(startStr?: string, endStr?: string): string {
  if (!startStr || !endStr) return "-";
  const diff = parseHour(endStr) - parseHour(startStr);
  if (diff <= 0) return "Nieprawidłowy czas";
  const hours = Math.floor(diff);
  const mins = Math.round((diff - hours) * 60);
  if (hours > 0 && mins > 0) return `${hours} godz. ${mins} min`;
  if (hours > 0) return `${hours} godz.`;
  return `${mins} min`;
}

function isSameDay(a: CalendarDate, b: CalendarDate) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

const EMPTY_ARRAY: never[] = [];

// ─── Types ────────────────────────────────────────────────────────────────────

type CalEvent = {
  _id: Id<"calendarEvents">;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  isAllDay?: boolean;
  endDate?: string;
  color?: string;
  isPrivate?: boolean;
  recurrence?: "none" | "daily" | "weekly" | "monthly" | "yearly";
  recurrenceInterval?: number;
  recurrenceEndDate?: string;
  parentEventId?: Id<"calendarEvents">;
  type?: "private" | "company";
  category?: string;
  orderId?: Id<"orders">;
  quoteId?: Id<"quotes">;
  createdBy: Id<"users">;
  createdAt: number;
};

type FormState = {
  mode: "create" | "edit";
  eventId?: Id<"calendarEvents">;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  isAllDay?: boolean;
  endDate?: string;
  recurrence: "none" | "daily" | "weekly" | "monthly" | "yearly";
  recurrenceInterval: number;
  recurrenceEndDate: string;
  isPrivate: boolean;
  type?: "private" | "company";
  category?: string;
  orderId?: Id<"orders">;
  createdBy?: Id<"users">;
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
  currentUserId,
  categories,
  onOpenOrder,
}: {
  isOpen: boolean;
  form: FormState;
  setForm: (f: FormState) => void;
  selectedDate: CalendarDate;
  onSave: () => void;
  onDelete?: () => void;
  onCancel: () => void;
  saving: boolean;
  currentUserId?: Id<"users">;
  categories: CategoryStyle[];
  onOpenOrder?: (orderId: Id<"orders">) => void;
}) {
  const isReadOnly =
    form.mode === "edit" &&
    form.type !== "company" &&
    form.createdBy !== undefined &&
    form.createdBy !== currentUserId;

  const timeOptions = HOURS.flatMap((h) => [
    `${String(h).padStart(2, "0")}:00`,
    `${String(h).padStart(2, "0")}:30`,
  ]).concat(["17:00"]);

  const durationText = formatDurationLabel(form.startTime, form.endTime);
  const router = useRouter();

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
            {form.mode === "create"
              ? `Nowe wydarzenie ${form.type === "company" ? "firmowe" : "prywatne"}`
              : isReadOnly
              ? "Szczegóły wydarzenia"
              : `Edycja wydarzenia ${form.type === "company" ? "firmowe" : "prywatne"}`}
          </span>
        </div>
        <div className="cal-drawer-date-pill">
          📅 {formatDateLabel(selectedDate)}
        </div>
        {form.orderId && (
          <button
            type="button"
            className="fluent-btn fluent-btn-primary"
            style={{ marginTop: 8, width: "100%", justifyContent: "center" }}
            onClick={() => {
              const oid = form.orderId!;
              if (onOpenOrder) onOpenOrder(oid);
              else router.push(`/admin/zlecenia/${oid}`);
            }}
          >
            ➜ Otwórz zlecenie
          </button>
        )}
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
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              disabled={isReadOnly}
            />
          </div>
          <div className="cal-form-group" style={{ marginTop: 12 }}>
            <label className="cal-label">
              Data wydarzenia {!!form.isAllDay ? "(od - do)" : ""} *
            </label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="date"
                className="cal-input"
                value={form.date}
                onChange={(e) => {
                  const newDate = e.target.value;
                  // Auto-update endDate if it was previously same as start date
                  setForm({ ...form, date: newDate, endDate: form.endDate === form.date || !form.endDate ? newDate : form.endDate });
                }}
                disabled={isReadOnly}
              />
              {!!form.isAllDay && (
                <>
                  <span style={{ color: "var(--text-muted)" }}>-</span>
                  <input
                    type="date"
                    className="cal-input"
                    value={form.endDate || form.date}
                    min={form.date}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    disabled={isReadOnly}
                  />
                </>
              )}
            </div>
          </div>
          <div className="cal-form-group" style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              id="isAllDay"
              checked={!!form.isAllDay}
              onChange={(e) => setForm({ ...form, isAllDay: e.target.checked })}
              disabled={isReadOnly}
              style={{ width: 16, height: 16 }}
            />
            <label htmlFor="isAllDay" className="cal-label" style={{ marginBottom: 0, cursor: "pointer" }}>Cały dzień</label>
          </div>
          {form.type === "company" && (
            <div className="cal-form-group" style={{ marginTop: 12 }}>
              <label className="cal-label">Kategoria wydarzenia</label>
              <select
                className="cal-select"
                value={form.category || "spotkanie"}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                disabled={isReadOnly}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="cal-form-group" style={{ marginTop: 12 }}>
            <label className="cal-label">Opis / Notatki</label>
            <textarea
              className="cal-textarea"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              disabled={isReadOnly}
              rows={3}
            />
          </div>
        </div>

        {/* Card 2: Godziny */}
        {!form.isAllDay && (
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
                  disabled={isReadOnly}
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
                  disabled={isReadOnly}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                >
                  {timeOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Card 3: Cykliczność / powtarzanie */}
        {form.mode === "create" && (
          <div className="cal-card">
            <div className="cal-card-title">Cykliczność wydarzenia</div>
            <div className="cal-form-group" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                id="isRecurring"
                checked={form.recurrence !== "none"}
                onChange={(e) => setForm({ ...form, recurrence: e.target.checked ? "weekly" : "none" })}
                style={{ width: 16, height: 16 }}
              />
              <label htmlFor="isRecurring" className="cal-label" style={{ marginBottom: 0, cursor: "pointer" }}>Powtarzaj wydarzenie</label>
            </div>

            {form.recurrence !== "none" && (
              <>
                <div style={{ display: "flex", gap: "12px", marginTop: "12px", alignItems: "flex-end" }}>
                  <div className="cal-form-group" style={{ flex: 1 }}>
                    <label className="cal-label">Powtarzaj co</label>
                    <input
                      type="number"
                      min={1}
                      className="cal-input"
                      value={form.recurrenceInterval}
                      onChange={(e) =>
                        setForm({ ...form, recurrenceInterval: Math.max(1, parseInt(e.target.value) || 1) })
                      }
                    />
                  </div>
                  <div className="cal-form-group" style={{ flex: 2 }}>
                    <label className="cal-label">&nbsp;</label>
                    <select
                      className="cal-select"
                      value={form.recurrence}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          recurrence: e.target.value as FormState["recurrence"],
                        })
                      }
                    >
                      <option value="daily">Dzień</option>
                      <option value="weekly">Tydzień</option>
                      <option value="monthly">Miesiąc</option>
                      <option value="yearly">Rok</option>
                    </select>
                  </div>
                </div>

                <div className="cal-form-group" style={{ marginTop: 12 }}>
                  <label className="cal-label">Koniec powtarzania (opcjonalnie)</label>
                  <input
                    type="date"
                    className="cal-input"
                    value={form.recurrenceEndDate}
                    min={form.date}
                    onChange={(e) =>
                      setForm({ ...form, recurrenceEndDate: e.target.value })
                    }
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Card 4: Prywatność */}
        {form.type !== "company" && (
          <div className="cal-card">
            <div className="cal-card-title">Prywatność</div>
            <label
              className="cal-checkbox-label"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: isReadOnly ? "default" : "pointer",
                marginTop: "4px",
              }}
            >
              <input
                type="checkbox"
                className="cal-checkbox"
                checked={form.isPrivate}
                onChange={(e) => setForm({ ...form, isPrivate: e.target.checked })}
                disabled={isReadOnly}
              />
              <span className="cal-checkbox-text" style={{ fontSize: "13px", color: "#c9d1d9" }}>
                Wydarzenie prywatne (tylko ja widzę szczegóły, inni widzą „🔒 Zajęty”)
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Footer bar */}
      <div className="cal-drawer-footer">
        {form.mode === "edit" && onDelete && !isReadOnly ? (
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
            {isReadOnly ? "Zamknij" : "Anuluj"}
          </button>
          {!isReadOnly && (
            <button
              type="button"
              className="cal-btn cal-btn--primary"
              onClick={onSave}
              disabled={saving || !form.title.trim()}
            >
              {saving ? "Zapisywanie…" : "Zapisz wydarzenie"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskDrawer({
  isOpen,
  onClose,
  users,
  form,
  setForm,
  currentUserId,
}: {
  isOpen: boolean;
  onClose: () => void;
  users: Array<{ _id: Id<"users">; name: string | null; email: string | null }>;
  form: { title: string; description: string; assigneeIds: string[]; dueDate: string };
  setForm: (f: { title: string; description: string; assigneeIds: string[]; dueDate: string }) => void;
  currentUserId?: string | null;
}) {
  const addTask = useMutation(api.tasks.add);
  const [saving, setSaving] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function onClick(e: MouseEvent) {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [dropdownOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = form.title.trim();
    if (!t) {
      toast.error("Tytuł zadania jest wymagany");
      return;
    }
    setSaving(true);
    try {
      await addTask({
        title: t,
        description: form.description.trim() || undefined,
        assigneeIds: form.assigneeIds.length > 0 ? (form.assigneeIds as Id<"users">[]) : undefined,
        dueDate: form.dueDate || undefined,
        status: "todo",
      });
      toast.success("Zadanie zostało utworzone pomyślnie!");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się utworzyć zadania");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`cal-drawer ${isOpen ? "cal-drawer--open" : ""}`} style={{ position: "fixed", zIndex: 49 }}>
      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header */}
        <div className="cal-drawer-header">
          <div className="cal-drawer-header-top">
            <button
              type="button"
              className="cal-drawer-back"
              onClick={onClose}
              title="Powrót"
            >
              ← Powrót
            </button>
            <span className="cal-drawer-mode-badge" style={{ background: "#25d36615", color: "#25d366", borderColor: "#25d36640" }}>
              Nowe Zadanie
            </span>
          </div>
          <div className="cal-drawer-date-pill">
            📋 Zadanie CRM
          </div>
        </div>

        {/* Body */}
        <div className="cal-drawer-body">
          {/* Card 1: Tytuł i opis */}
          <div className="cal-card">
            <div className="cal-card-title">Informacje podstawowe</div>
            <div className="cal-form-group">
              <label className="cal-label">Tytuł zadania *</label>
              <input
                type="text"
                className="cal-input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Wpisz tytuł zadania..."
                required
                disabled={saving}
                autoFocus
              />
            </div>

            <div className="cal-form-group" style={{ marginTop: 12 }}>
              <label className="cal-label">Opis zadania / Notatki</label>
              <textarea
                className="cal-textarea"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Wpisz szczegółowy opis..."
                disabled={saving}
                rows={3}
              />
            </div>
          </div>

          {/* Card 2: Przypisanie i termin */}
          <div className="cal-card" style={{ overflow: "visible" }}>
            <div className="cal-form-group" ref={dropdownRef} style={{ position: "relative" }}>
              <label className="cal-label">Przypisz do osób</label>
              <button
                type="button"
                className="cal-select"
                style={{ display: "flex", alignItems: "center", gap: "8px", textAlign: "left", width: "100%", background: "#0d1117", marginTop: "6px" }}
                onClick={() => setDropdownOpen((v) => !v)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ opacity: 0.7 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {form.assigneeIds.length === 0
                    ? "Wybierz osoby..."
                    : form.assigneeIds.length === 1
                    ? (users.find(u => u._id === form.assigneeIds[0])?.name || users.find(u => u._id === form.assigneeIds[0])?.email || "1 osoba")
                    : `${form.assigneeIds.length} przypisanych osób`}
                </span>
                <span style={{ fontSize: "10px", opacity: 0.6 }}>▼</span>
              </button>
              {dropdownOpen && (
                <div
                  className="quote-detail-task-assignee-popover"
                  role="listbox"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    padding: "4px",
                    background: "#161b22",
                    border: "1px solid #30363d",
                    borderRadius: "8px",
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)"
                  }}
                >
                  {currentUserId && !form.assigneeIds.includes(currentUserId) && (
                    <>
                      <button
                        type="button"
                        className="quote-detail-task-assignee-option quote-detail-task-assignee-option-me"
                        style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "6px 8px", color: "#ffffff" }}
                        onClick={() => {
                          setForm({ ...form, assigneeIds: [...form.assigneeIds, currentUserId] });
                        }}
                      >
                        <span className="kanban-card-owner-avatar quote-detail-task-assignee-option-avatar quote-detail-task-assignee-option-avatar-me" style={{ border: "1px solid #2563eb", background: "#eff6ff", color: "#2563eb" }}>
                          +
                        </span>
                        <span>Przypisz mnie</span>
                      </button>
                      <div className="quote-detail-task-assignee-sep" aria-hidden />
                    </>
                  )}
                  {users.map((u) => {
                    const label = u.name?.trim() || u.email?.trim() || "—";
                    const active = form.assigneeIds.includes(u._id);
                    const isMe = currentUserId === u._id;
                    return (
                      <button
                        key={u._id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`quote-detail-task-assignee-option${active ? " is-active" : ""}`}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "6px 8px", color: "#ffffff" }}
                        onClick={() => {
                          const nextIds = active
                            ? form.assigneeIds.filter((id) => id !== u._id)
                            : [...form.assigneeIds, u._id];
                          setForm({ ...form, assigneeIds: nextIds });
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="kanban-card-owner-avatar quote-detail-task-assignee-option-avatar">
                            {ownerInitials(label)}
                          </span>
                          <span>
                            {label}
                            {isMe && (
                              <span className="quote-detail-task-assignee-option-tag" style={{ marginLeft: "6px" }}>Ty</span>
                            )}
                          </span>
                        </div>
                        {active && (
                          <span style={{ color: "#3fb950", fontSize: "12px", marginLeft: "8px" }}>✓</span>
                        )}
                      </button>
                    );
                  })}
                  {form.assigneeIds.length > 0 && (
                    <div style={{ borderTop: "1px solid #21262d", marginTop: "4px", paddingTop: "4px" }}>
                      <button
                        type="button"
                        className="quote-detail-task-assignee-option"
                        style={{ width: "100%", color: "#f85149", justifyContent: "center", padding: "6px" }}
                        onClick={() => {
                          setForm({ ...form, assigneeIds: [] });
                          setDropdownOpen(false);
                        }}
                      >
                        <span>Wyczyść przypisania</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="cal-form-group" style={{ marginTop: 12 }}>
              <label className="cal-label">Termin realizacji</label>
              <input
                type="date"
                className="cal-input"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                disabled={saving}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="cal-drawer-footer">
          <div />
          <div className="cal-drawer-footer-right">
            <button
              type="button"
              className="cal-btn cal-btn--ghost"
              onClick={onClose}
              disabled={saving}
            >
              Anuluj
            </button>
            <button
              type="submit"
              className="cal-btn cal-btn--primary"
              style={{ background: "#25d366" }}
              disabled={saving || !form.title.trim()}
            >
              {saving ? "Zapisywanie…" : "Zapisz zadanie"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function packEvents(sortedEvents: CalEvent[]): {
  clusters: {
    events: CalEvent[];
    maxCols: number;
    positions: Map<string, number>;
  }[];
} {
  const clusters: {
    events: CalEvent[];
    maxCols: number;
    positions: Map<string, number>;
  }[] = [];

  for (const ev of sortedEvents) {
    const startH = parseHour(ev.startTime);
    let placed = false;

    for (const cluster of clusters) {
      const overlaps = cluster.events.some((e) => {
        const eStart = parseHour(e.startTime);
        const eEnd = parseHour(e.endTime);
        const evEnd = parseHour(ev.endTime);
        return startH < eEnd && parseHour(ev.startTime) < eEnd && eStart < evEnd;
      });

      if (overlaps) {
        cluster.events.push(ev);
        let colIdx = 0;
        while (true) {
          const colHasOverlap = cluster.events.some((e) => {
            if (e._id === ev._id) return false;
            if (cluster.positions.get(e._id) !== colIdx) return false;
            const eStart = parseHour(e.startTime);
            const eEnd = parseHour(e.endTime);
            const evEnd = parseHour(ev.endTime);
            return startH < eEnd && parseHour(ev.startTime) < eEnd && eStart < evEnd;
          });
          if (!colHasOverlap) break;
          colIdx++;
        }
        cluster.positions.set(ev._id, colIdx);
        cluster.maxCols = Math.max(cluster.maxCols, colIdx + 1);
        placed = true;
        break;
      }
    }

    if (!placed) {
      clusters.push({
        events: [ev],
        maxCols: 1,
        positions: new Map([[ev._id, 0]]),
      });
    }
  }

  return { clusters };
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({
  selectedDate,
  events,
  onSlotClick,
  onEventClick,
  onAddClick,
  onEventUpdate,
  selectedUserIds,
  currentUserId,
}: {
  selectedDate: CalendarDate;
  events: CalEvent[];
  onSlotClick: (startHour: number, endHour?: number) => void;
  onEventClick: (event: CalEvent) => void;
  onAddClick: () => void;
  onEventUpdate?: (id: Id<"calendarEvents">, startTime: string, endTime: string) => void;
  selectedUserIds: Id<"users">[];
  currentUserId?: Id<"users">;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  const [dragState, setDragState] = useState<{
    type: "move" | "resize";
    eventId: Id<"calendarEvents">;
    originalStart: number;
    originalEnd: number;
    currentStart: number;
    currentEnd: number;
    grabOffsetY: number;
    didMove: boolean;
  } | null>(null);

  const [createDrag, setCreateDrag] = useState<{
    startHour: number;
    currentHour: number;
  } | null>(null);

  useEffect(() => {
    if (!createDrag) return;

    function handlePointerMove(e: PointerEvent) {
      if (!gridRef.current || !createDrag) return;
      const rect = gridRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const rawHour = 8 + y / HOUR_HEIGHT;
      const snappedHour = Math.max(
        8,
        Math.min(17, Math.round(rawHour * 2) / 2)
      );
      setCreateDrag((prev) =>
        prev ? { ...prev, currentHour: snappedHour } : null
      );
    }

    function handlePointerUp() {
      if (!createDrag) return;
      const start = createDrag.startHour;
      const end = createDrag.currentHour;
      const minHour = Math.min(start, end);
      const maxHour = Math.max(start, end);
      const duration = maxHour - minHour;
      const finalEnd = duration === 0 ? Math.min(minHour + 1, 17) : maxHour;

      suppressClickRef.current = true;
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 150);

      onSlotClick(minHour, finalEnd);
      setCreateDrag(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [createDrag, onSlotClick]);

  useEffect(() => {
    if (!dragState) return;

    function handlePointerMove(e: PointerEvent) {
      if (!gridRef.current || !dragState) return;
      const rect = gridRef.current.getBoundingClientRect();

      if (dragState.type === "move") {
        const y = e.clientY - rect.top - dragState.grabOffsetY;
        const duration = dragState.originalEnd - dragState.originalStart;
        const rawHour = 8 + y / HOUR_HEIGHT;
        const snappedStart = Math.max(
          8,
          Math.min(17 - duration, Math.round(rawHour * 2) / 2),
        );
        const didMove = Math.abs(snappedStart - dragState.originalStart) >= 0.25;
        setDragState((prev) =>
          prev ? {
            ...prev,
            currentStart: snappedStart,
            currentEnd: snappedStart + duration,
            didMove: prev.didMove || didMove,
          } : null,
        );
      } else if (dragState.type === "resize") {
        const y = e.clientY - rect.top;
        const rawEnd = 8 + y / HOUR_HEIGHT;
        const snappedEnd = Math.max(
          dragState.originalStart + 0.5,
          Math.min(17, Math.round(rawEnd * 2) / 2),
        );
        const didMove = Math.abs(snappedEnd - dragState.originalEnd) >= 0.25;
        setDragState((prev) =>
          prev ? {
            ...prev,
            currentEnd: snappedEnd,
            didMove: prev.didMove || didMove,
          } : null,
        );
      }
    }

    function handlePointerUp() {
      if (!dragState) return;
      if (dragState.didMove) {
        suppressClickRef.current = true;
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 250);
        if (onEventUpdate) {
          onEventUpdate(
            dragState.eventId,
            formatHour(dragState.currentStart),
            formatHour(dragState.currentEnd),
          );
        }
      }
      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, onEventUpdate]);

  // 1. Filter events by selected users
  const activeEvents = events.filter((ev) => selectedUserIds.includes(ev.createdBy));

  // 2. Sort events by start hour (and then duration desc)
  const sortedEvents = [...activeEvents].sort((a, b) => {
    const startA = parseHour(a.startTime);
    const startB = parseHour(b.startTime);
    if (Math.abs(startA - startB) > 0.001) {
      return startA - startB;
    }
    return parseHour(b.endTime) - parseHour(a.endTime);
  });

  // 3. Simple packing algorithm for overlapping events in a single column
  const { clusters } = packEvents(sortedEvents);

  const holiday = getPolishHoliday(selectedDate.year, selectedDate.month, selectedDate.day);

  return (
    <div className="cal-day-view">
      <div className="cal-day-header">
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div className="cal-day-header-title" style={holiday ? { color: "#ff7b72" } : undefined}>
            {formatDateLabel(selectedDate)}
          </div>
          {holiday && (
            <span style={{ fontSize: "11.5px", color: "#ff7b72", fontWeight: 500, marginTop: "2px" }}>
              🎉 {holiday}
            </span>
          )}
        </div>
        <button
          type="button"
          className="cal-day-add-btn"
          onClick={onAddClick}
        >
          + Dodaj
        </button>
      </div>

      <div
        ref={gridRef}
        className="cal-day-grid"
        style={{ height: HOURS.length * HOUR_HEIGHT }}
      >
        {/* Hour lines */}
        {HOURS.map((h) => (
          <div
            key={h}
            className="cal-hour-slot"
            style={{ top: (h - 8) * HOUR_HEIGHT, height: HOUR_HEIGHT, touchAction: "none" }}
            onClick={() => {
              if (!dragState && !createDrag && !suppressClickRef.current) onSlotClick(h);
            }}
            onPointerDown={(e) => {
              if (dragState) return;
              if (e.button !== 0) return; // Left click only
              const rect = e.currentTarget.getBoundingClientRect();
              const relativeY = e.clientY - rect.top;
              const clickedHalf = relativeY >= HOUR_HEIGHT / 2 ? 0.5 : 0;
              const startHour = h + clickedHalf;
              setCreateDrag({
                startHour,
                currentHour: startHour,
              });
            }}
          >
            <span className="cal-hour-label">
              {String(h).padStart(2, "0")}:00
            </span>
          </div>
        ))}

        {/* Preview drag-create block */}
        {createDrag && (() => {
          const minHour = Math.min(createDrag.startHour, createDrag.currentHour);
          const maxHour = Math.max(createDrag.startHour, createDrag.currentHour);
          const top = (minHour - 8) * HOUR_HEIGHT;
          const duration = maxHour - minHour;
          const finalDuration = duration === 0 ? 0.5 : duration;
          const height = finalDuration * HOUR_HEIGHT;
          const color = getUserColor(currentUserId);
          
          return (
            <div
              className="cal-event-block"
              style={{
                top,
                height,
                left: "54px",
                width: "calc(100% - 58px)",
                borderLeftColor: color,
                background: `${color}12`,
                borderStyle: "dashed",
                borderWidth: "1px",
                borderLeftWidth: "4px",
                opacity: 0.8,
                pointerEvents: "none",
                zIndex: 5,
              }}
            >
              <span className="cal-event-time">
                {formatHour(minHour)}–{formatHour(minHour + finalDuration)}
              </span>
              <span className="cal-event-title" style={{ fontStyle: "italic", opacity: 0.7 }}>
                Nowe zadanie...
              </span>
            </div>
          );
        })()}

        {/* Events */}
        {sortedEvents.map((ev) => {
          if (!ev || !ev.startTime || !ev.endTime) return null;

          const isDraggingThis = dragState?.eventId === ev._id;
          const startH = isDraggingThis ? dragState.currentStart : parseHour(ev.startTime);
          const endH = isDraggingThis ? dragState.currentEnd : parseHour(ev.endTime);
          const top = (startH - 8) * HOUR_HEIGHT;
          const height = Math.max((endH - startH) * HOUR_HEIGHT, 28);
          const color = ev.color || getUserColor(ev.createdBy);

          const timeLabel = isDraggingThis
            ? `${formatHour(startH)}–${formatHour(endH)}`
            : `${ev.startTime}–${ev.endTime}`;

          const isMine = ev.createdBy === currentUserId;
          const isPrivateForOthers = ev.isPrivate && !isMine;

          // Find position inside cluster
          const cluster = clusters.find((c) => c.events.some((e) => e._id === ev._id));
          const colIdx = cluster?.positions.get(ev._id) ?? 0;
          const maxCols = cluster?.maxCols ?? 1;

          const leftStyle = `calc(54px + ${colIdx} * (100% - 58px) / ${maxCols})`;
          const widthStyle = `calc((100% - 58px) / ${maxCols} - 4px)`;

          return (
            <div
              key={ev._id}
              className={`cal-event-block ${isDraggingThis ? "cal-event-block--dragging" : ""} ${!isMine ? "cal-event-block--readonly" : ""}`}
              style={{
                top,
                height,
                left: leftStyle,
                width: widthStyle,
                borderLeftColor: color,
                background: `${color}1e`,
              }}
              onPointerDown={(e) => {
                if (!isMine) return;
                if ((e.target as HTMLElement).closest(".cal-event-resize-handle")) return;
                const rect = e.currentTarget.getBoundingClientRect();
                setDragState({
                  type: "move",
                  eventId: ev._id,
                  originalStart: parseHour(ev.startTime),
                  originalEnd: parseHour(ev.endTime),
                  currentStart: parseHour(ev.startTime),
                  currentEnd: parseHour(ev.endTime),
                  grabOffsetY: e.clientY - rect.top,
                  didMove: false,
                });
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (isPrivateForOthers) {
                  toast.info("To wydarzenie jest prywatne");
                  return;
                }
                if (!suppressClickRef.current && !dragState?.didMove) {
                  onEventClick(ev);
                }
              }}
            >
              <span className="cal-event-time">
                {timeLabel}
                {ev.recurrence && ev.recurrence !== "none" && (
                  ev.recurrenceInterval && ev.recurrenceInterval > 1
                    ? ` 🔄 co ${ev.recurrenceInterval} ${ev.recurrence === "daily" ? "dni" : ev.recurrence === "weekly" ? "tyg" : ev.recurrence === "monthly" ? "msc" : "lat"}`
                    : ` 🔄 co ${ev.recurrence === "daily" ? "dzień" : ev.recurrence === "weekly" ? "tydzień" : ev.recurrence === "monthly" ? "miesiąc" : "rok"}`
                )}
                {ev.isPrivate && " 🔒"}
                {ev.orderId && " 🔗"}
              </span>
              <span className="cal-event-title">{ev.title}</span>

              {/* Resize handle at bottom (only for mine) */}
              {isMine && (
                <div
                  className="cal-event-resize-handle"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDragState({
                      type: "resize",
                      eventId: ev._id,
                      originalStart: parseHour(ev.startTime),
                      originalEnd: parseHour(ev.endTime),
                      currentStart: parseHour(ev.startTime),
                      currentEnd: parseHour(ev.endTime),
                      grabOffsetY: 0,
                      didMove: false,
                    });
                  }}
                >
                  <div className="cal-event-resize-bar" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main CalendarPanel ───────────────────────────────────────────────────────

class CalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", color: "#f85149", fontSize: "13px" }}>
          <strong>Błąd wyświetlania kalendarza:</strong>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: "8px", color: "#c9d1d9" }}>
            {this.state.error?.message || "Nieznany błąd"}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export function CalendarPanel() {
  const [open, setOpen] = useState(false);
  const [isCompanyOpen, setIsCompanyOpen] = useState(false);
  const router = useRouter();

  function handleOpenOrder(orderId: Id<"orders">) {
    setIsDrawerOpen(false);
    setOpen(false);
    setIsCompanyOpen(false);
    router.push(`/admin/zlecenia/${orderId}`);
  }
  const [menuExpanded, setMenuExpanded] = useState(false);
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    assigneeIds: [] as string[],
    dueDate: "",
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<CalendarDate>(() => {
    try {
      return today(getLocalTimeZone());
    } catch {
      return today("Europe/Warsaw");
    }
  });

  // ─── Dynamic Calendar Categories ─────────────────────────────────────────
  const categoriesRaw = useQuery(api.calendarCategories.list) ?? [];
  const seedCategories = useMutation(api.calendarCategories.checkAndSeed);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true;
      seedCategories().catch(() => {});
    }
  }, [seedCategories]);

  const companyCategories: CategoryStyle[] = categoriesRaw.map((c: any) => ({
    id: c.code || c._id,
    label: c.name,
    color: c.color,
    bg: hexToRgba(c.color, 0.12),
    border: hexToRgba(c.color, 0.3),
  }));

  const getCategoryStyle = useCallback(
    (catId?: string): CategoryStyle => {
      if (!catId) return companyCategories[companyCategories.length - 1] || FALLBACK_CATEGORY;
      const cat = companyCategories.find((c) => c.id === catId);
      return cat || companyCategories[companyCategories.length - 1] || FALLBACK_CATEGORY;
    },
    [companyCategories],
  );

  const allUsersRaw = useQuery(api.users.listAllAssignable) ?? [];
  const currentUser = allUsersRaw.find((u: any) => u.isCurrentUser);
  const currentUserId = currentUser?._id;

  const allUsers = [...allUsersRaw].sort((a: any, b: any) => {
    if (a.isCurrentUser) return -1;
    if (b.isCurrentUser) return 1;
    return (a.name || a.email || "").localeCompare(b.name || b.email || "");
  });
  const [selectedUserIds, setSelectedUserIds] = useState<Id<"users">[]>([]);

  useEffect(() => {
    if (currentUserId && selectedUserIds.length === 0) {
      const timer = setTimeout(() => {
        setSelectedUserIds([currentUserId]);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [currentUserId, selectedUserIds.length]);

  const [form, setForm] = useState<FormState>({
    mode: "create",
    title: "",
    description: "",
    date: "",
    startTime: "09:00",
    endTime: "10:00",
    recurrence: "none",
    recurrenceInterval: 1,
    recurrenceEndDate: "",
    isPrivate: false,
    type: "private",
    category: "spotkanie",
  });
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const dateStr = dateToString(selectedDate);
  const events = useQuery(
    api.calendarEvents.listByDateAndUsers,
    selectedUserIds.length > 0 ? { date: dateStr, userIds: selectedUserIds } : "skip"
  );

  const [companyViewMode, setCompanyViewMode] = useState<"week" | "month">("week");

  const weekDateStrings = getWeekDateStrings(selectedDate);
  const monthGridDays = getMonthGridDays(selectedDate);

  const privateMonthEvents = useQuery(
    api.calendarEvents.listPrivateEventsByRange,
    open && selectedUserIds.length > 0
      ? { startDate: monthGridDays[0], endDate: monthGridDays[41], userIds: selectedUserIds }
      : "skip"
  ) ?? (EMPTY_ARRAY as CalEvent[]);

  const startDate = companyViewMode === "week" ? weekDateStrings[0] : monthGridDays[0];
  const endDate = companyViewMode === "week" ? weekDateStrings[6] : monthGridDays[41];

  const companyEvents = useQuery(
    api.calendarEvents.listCompanyEventsByRange,
    isCompanyOpen ? { startDate, endDate } : "skip"
  ) ?? (EMPTY_ARRAY as CalEvent[]);

  const createEvent = useMutation(api.calendarEvents.create);
  const updateEvent = useMutation(api.calendarEvents.update);
  const removeEvent = useMutation(api.calendarEvents.remove);

  const [compDragState, setCompDragState] = useState<{
    type: "move" | "resize" | "month-move" | "allday-resize" | "month-resize";
    eventId: Id<"calendarEvents">;
    originalDate: string;
    originalEndDate?: string;
    originalStart: number;
    originalEnd: number;
    currentDate: string;
    currentEndDate?: string;
    currentStart: number;
    currentEnd: number;
    grabOffsetY: number;
    grabOffsetX: number;
    didMove: boolean;
  } | null>(null);

  const weekGridRef = useRef<HTMLDivElement>(null);
  const monthGridRef = useRef<HTMLDivElement>(null);
  const suppressCompanyClickRef = useRef(false);

  const handleSlotClick = useCallback((startHour: number, endHour?: number) => {
    const finalEndHour = endHour !== undefined ? endHour : Math.min(startHour + 1, 17);
    setForm({
      mode: "create",
      title: "",
      description: "",
      date: dateStr,
      startTime: formatHour(startHour),
      endTime: formatHour(finalEndHour),
      isAllDay: false,
      endDate: dateStr,
      recurrence: "none",
      recurrenceInterval: 1,
      recurrenceEndDate: "",
      isPrivate: false,
      type: "private",
      category: "spotkanie",
      createdBy: currentUserId,
    });
    setIsDrawerOpen(true);
  }, [currentUserId, dateStr, setForm, setIsDrawerOpen]);

  const handleCompanyAddClick = useCallback((dayStr: string, startHour?: number, endHour?: number) => {
    const [y, m, d] = dayStr.split("-").map(Number);
    const newDate = {
      year: y,
      month: m,
      day: d,
      calendar: selectedDate.calendar,
      era: selectedDate.era,
      copy() { return this; }
    } as CalendarDate;
    setSelectedDate(newDate);

    const startH = startHour !== undefined ? startHour : 9;
    const endH = endHour !== undefined ? endHour : (startHour !== undefined ? Math.min(startHour + 1, 17) : 10);

    setForm({
      mode: "create",
      title: "",
      description: "",
      date: dayStr,
      startTime: formatHour(startH),
      endTime: formatHour(endH),
      isAllDay: false,
      endDate: dayStr,
      recurrence: "none",
      recurrenceInterval: 1,
      recurrenceEndDate: "",
      isPrivate: false,
      type: "company",
      category: "spotkanie",
      createdBy: currentUserId,
    });
    setIsDrawerOpen(true);
  }, [selectedDate, currentUserId, setSelectedDate, setForm, setIsDrawerOpen]);

  useEffect(() => {
    if (!compDragState) return;

    function handlePointerMove(e: PointerEvent) {
      if (!compDragState) return;

      if (compDragState.type === "move" || compDragState.type === "resize") {
        if (!weekGridRef.current) return;
        const rect = weekGridRef.current.getBoundingClientRect();
        
        if (compDragState.type === "move") {
          const y = e.clientY - rect.top - compDragState.grabOffsetY;
          const duration = compDragState.originalEnd - compDragState.originalStart;
          const rawHour = 8 + y / HOUR_HEIGHT;
          
          // Lock hour if shift is pressed
          const snappedStart = e.shiftKey
            ? compDragState.originalStart
            : Math.max(8, Math.min(17 - duration, Math.round(rawHour * 2) / 2));
          
          const x = e.clientX - rect.left - 54;
          const colWidth = (rect.width - 54) / 7;
          const colIdx = Math.max(0, Math.min(6, Math.floor(x / colWidth)));
          const targetDate = weekDateStrings[colIdx];

          const didMove = targetDate !== compDragState.originalDate || Math.abs(snappedStart - compDragState.originalStart) >= 0.25;

          setCompDragState(prev => prev ? {
            ...prev,
            currentStart: snappedStart,
            currentEnd: snappedStart + duration,
            currentDate: targetDate,
            didMove: prev.didMove || didMove
          } : null);
        } else {
          const y = e.clientY - rect.top;
          const rawEnd = 8 + y / HOUR_HEIGHT;
          const snappedEnd = Math.max(compDragState.originalStart + 0.5, Math.min(17, Math.round(rawEnd * 2) / 2));

          const didMove = Math.abs(snappedEnd - compDragState.originalEnd) >= 0.25;

          setCompDragState(prev => prev ? {
            ...prev,
            currentEnd: snappedEnd,
            didMove: prev.didMove || didMove
          } : null);
        }
      } else if (compDragState.type === "month-move" || compDragState.type === "month-resize") {
        if (!monthGridRef.current) return;
        const rect = monthGridRef.current.getBoundingClientRect();

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const colWidth = rect.width / 7;
        const rowHeight = rect.height / 6;

        const colIdx = Math.max(0, Math.min(6, Math.floor(x / colWidth)));
        const rowIdx = Math.max(0, Math.min(5, Math.floor(y / rowHeight)));
        const targetIdx = rowIdx * 7 + colIdx;
        const targetDate = monthGridDays[targetIdx];

        if (compDragState.type === "month-move") {
          const didMove = targetDate !== compDragState.originalDate;
          setCompDragState(prev => prev ? {
            ...prev,
            currentDate: targetDate,
            didMove: prev.didMove || didMove
          } : null);
        } else {
          // month-resize
          if (targetDate >= compDragState.currentDate) {
            const didMove = targetDate !== compDragState.originalEndDate;
            setCompDragState(prev => prev ? {
              ...prev,
              currentEndDate: targetDate,
              didMove: prev.didMove || didMove
            } : null);
          }
        }
      } else if (compDragState.type === "allday-resize") {
        // week grid resize for all day
        if (!weekGridRef.current) return;
        const rect = weekGridRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - 54;
        const colWidth = (rect.width - 54) / 7;
        const colIdx = Math.max(0, Math.min(6, Math.floor(x / colWidth)));
        const targetDate = weekDateStrings[colIdx];
        
        if (targetDate >= compDragState.currentDate) {
          const didMove = targetDate !== compDragState.originalEndDate;
          setCompDragState(prev => prev ? {
            ...prev,
            currentEndDate: targetDate,
            didMove: prev.didMove || didMove
          } : null);
        }
      }
    }

    function handlePointerUp(e: PointerEvent) {
      if (!compDragState) return;

      if (compDragState.didMove) {
        suppressCompanyClickRef.current = true;
        setTimeout(() => {
          suppressCompanyClickRef.current = false;
        }, 150);

        if (compDragState.type === "allday-resize" || compDragState.type === "month-resize") {
          updateEvent({
            id: compDragState.eventId,
            endDate: compDragState.currentEndDate,
          }).catch((err) => {
            console.error("Failed to resize event:", err);
          });
        } else if (e.altKey) {
          // Alt/Option drag: copy event to target date
          const origEvent = companyEvents.find((ev: any) => ev._id === compDragState.eventId);
          if (origEvent) {
            createEvent({
              title: origEvent.title,
              description: origEvent.description || undefined,
              date: compDragState.currentDate,
              startTime: formatHour(compDragState.currentStart),
              endTime: formatHour(compDragState.currentEnd),
              color: origEvent.color || undefined,
              isPrivate: !!origEvent.isPrivate,
              recurrence: origEvent.recurrence || "none",
              recurrenceInterval: origEvent.recurrenceInterval || 1,
              recurrenceEndDate: origEvent.recurrenceEndDate || undefined,
              type: origEvent.type || "company",
              category: origEvent.category || undefined,
              isAllDay: origEvent.isAllDay,
              endDate: origEvent.endDate || origEvent.date,
            }).catch((err) => {
              console.error("Failed to duplicate event via drag:", err);
            });
          }
        } else {
          // Normal drag: move event
          updateEvent({
            id: compDragState.eventId,
            date: compDragState.currentDate,
            startTime: formatHour(compDragState.currentStart),
            endTime: formatHour(compDragState.currentEnd),
            endDate: compDragState.currentEndDate,
          }).catch((err) => {
            console.error("Failed to drag-update event:", err);
          });
        }
      }

      setCompDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [compDragState, updateEvent, weekDateStrings, monthGridDays, companyEvents, createEvent]);

  const [compCreateDrag, setCompCreateDrag] = useState<{
    dayStr: string;
    startHour: number;
    currentHour: number;
  } | null>(null);

  useEffect(() => {
    if (!compCreateDrag) return;

    function handlePointerMove(e: PointerEvent) {
      if (!weekGridRef.current || !compCreateDrag) return;
      const rect = weekGridRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const rawHour = 8 + y / HOUR_HEIGHT;
      const snappedHour = Math.max(
        8,
        Math.min(17, Math.round(rawHour * 2) / 2)
      );
      setCompCreateDrag((prev) =>
        prev ? { ...prev, currentHour: snappedHour } : null
      );
    }

    function handlePointerUp() {
      if (!compCreateDrag) return;
      const { dayStr, startHour, currentHour } = compCreateDrag;
      const minHour = Math.min(startHour, currentHour);
      const maxHour = Math.max(startHour, currentHour);
      const duration = maxHour - minHour;
      const finalEnd = duration === 0 ? Math.min(minHour + 1, 17) : maxHour;

      suppressCompanyClickRef.current = true;
      setTimeout(() => {
        suppressCompanyClickRef.current = false;
      }, 150);

      handleCompanyAddClick(dayStr, minHour, finalEnd);
      setCompCreateDrag(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [compCreateDrag, handleCompanyAddClick]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (isDrawerOpen) {
          setIsDrawerOpen(false);
        } else {
          setOpen(false);
          setIsCompanyOpen(false);
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isDrawerOpen]);

  // handleSlotClick moved above

  function handleAddHeaderClick() {
    setForm({
      mode: "create",
      title: "",
      description: "",
      date: dateStr,
      startTime: "09:00",
      endTime: "10:00",
      isAllDay: false,
      endDate: dateStr,
      recurrence: "none",
      recurrenceInterval: 1,
      recurrenceEndDate: "",
      isPrivate: false,
      type: "private",
      category: "spotkanie",
      createdBy: currentUserId,
    });
    setIsDrawerOpen(true);
  }

  function handleEventClick(ev: CalEvent) {
    setForm({
      mode: "edit",
      eventId: ev._id,
      title: ev.title,
      description: ev.description || "",
      date: ev.date,
      startTime: ev.startTime,
      endTime: ev.endTime,
      isAllDay: !!ev.isAllDay,
      endDate: ev.endDate || ev.date,
      recurrence: ev.recurrence || "none",
      recurrenceInterval: ev.recurrenceInterval || 1,
      recurrenceEndDate: ev.recurrenceEndDate || "",
      isPrivate: !!ev.isPrivate,
      type: ev.type || "private",
      category: ev.category || "spotkanie",
      orderId: ev.orderId,
      createdBy: ev.createdBy,
    });
    setIsDrawerOpen(true);
  }

  // handleCompanyAddClick moved above

  function handleCompanyEventClick(ev: CalEvent) {
    const [y, m, d] = ev.date.split("-").map(Number);
    const newDate = {
      year: y,
      month: m,
      day: d,
      calendar: selectedDate.calendar,
      era: selectedDate.era,
      copy() { return this; }
    } as CalendarDate;
    setSelectedDate(newDate);

    setForm({
      mode: "edit",
      eventId: ev._id,
      title: ev.title,
      description: ev.description || "",
      date: ev.date,
      startTime: ev.startTime,
      endTime: ev.endTime,
      isAllDay: !!ev.isAllDay,
      endDate: ev.endDate || ev.date,
      recurrence: ev.recurrence || "none",
      recurrenceInterval: ev.recurrenceInterval || 1,
      recurrenceEndDate: ev.recurrenceEndDate || "",
      isPrivate: !!ev.isPrivate,
      type: ev.type || "company",
      category: ev.category || "spotkanie",
      orderId: ev.orderId,
      createdBy: ev.createdBy,
    });
    setIsDrawerOpen(true);
  }

  const isReadOnly = form.mode === "edit" && form.createdBy !== currentUserId && form.type !== "company";

  async function handleQuickUpdate(
    id: Id<"calendarEvents">,
    startTime: string,
    endTime: string,
  ) {
    try {
      await updateEvent({ id, startTime, endTime });
      toast.success("Zmieniono czas wydarzenia");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Błąd aktualizacji czasu");
    }
  }

  async function handleSave() {
    if (!form || !form.title.trim()) return;
    setSaving(true);
    try {
      const targetDate = form.date || dateStr;
      if (form.mode === "create") {
        await createEvent({
          title: form.title,
          description: form.description || undefined,
          date: targetDate,
          startTime: form.startTime,
          endTime: form.endTime,
          isAllDay: form.isAllDay,
          endDate: form.isAllDay && form.endDate ? form.endDate : form.date,
          recurrence: form.recurrence,
          recurrenceInterval: form.recurrence !== "none" ? form.recurrenceInterval : undefined,
          recurrenceEndDate: form.recurrenceEndDate || undefined,
          isPrivate: form.isPrivate,
          type: form.type,
          category: form.type === "company" ? form.category : undefined,
        });
        toast.success("Wydarzenie dodane");
      } else if (form.eventId) {
        await updateEvent({
          id: form.eventId,
          title: form.title,
          description: form.description || null,
          date: targetDate,
          startTime: form.startTime,
          endTime: form.endTime,
          isAllDay: form.isAllDay,
          endDate: form.isAllDay && form.endDate ? form.endDate : targetDate,
          isPrivate: form.isPrivate,
          type: form.type,
          category: form.type === "company" ? form.category : null,
        });
        toast.success("Wydarzenie zaktualizowane");
      }
      
      if (targetDate !== dateStr) {
        const [y, m, d] = targetDate.split("-").map(Number);
        try {
          // Keep existing calendar and era if possible
          const newDate = {
            year: y,
            month: m,
            day: d,
            calendar: selectedDate.calendar,
            era: selectedDate.era,
            copy() { return this; }
          } as CalendarDate;
          setSelectedDate(newDate as any);
        } catch {
          setSelectedDate(new Date(Date.UTC(y, m - 1, d)) as any);
        }
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
      {(open || isCompanyOpen) && (
        <div
          className="cal-backdrop"
          onClick={() => {
            setIsDrawerOpen(false);
            setOpen(false);
            setIsCompanyOpen(false);
          }}
          aria-hidden="true"
        />
      )}

      {/* Sliding private panel */}
      <aside
        ref={panelRef}
        className={`cal-panel ${open ? "cal-panel--open" : ""}`}
        aria-label="Kalendarz prywatny"
      >
        <div className="cal-panel-header">
          <span className="cal-panel-title">Kalendarz prywatny</span>
          <button
            type="button"
            className="cal-panel-close"
            onClick={() => { setIsDrawerOpen(false); setOpen(false); }}
            aria-label="Zamknij kalendarz"
          >
            ✕
          </button>
        </div>

        {/* User Filter Bar */}
        <UserFilterBar
          users={allUsers as { _id: string; name: string | null; email: string | null }[]}
          selectedUserIds={selectedUserIds as string[]}
          currentUserId={currentUserId as string | undefined}
          onToggle={(id, isMe) => {
            if (isMe) return; // Ja jest zawsze wybrane
            setSelectedUserIds((prev) => {
              const prevStr = prev as string[];
              if (prevStr.includes(id)) {
                return prev.filter((pid) => pid !== id) as Id<"users">[];
              } else {
                return [...prev, id as Id<"users">];
              }
            });
          }}
        />

        <div className="cal-panel-body">
          <CalErrorBoundary>
            {/* ─── Month View (react-aria) ──────────────────────────────── */}
            <Calendar
              value={selectedDate}
              onChange={(d) => { setSelectedDate(d); setIsDrawerOpen(false); }}
              aria-label="Wybierz datę"
              className="cal-month"
            >
              <header className="cal-month-header">
                <div className="cal-month-nav-group">
                  <Button slot="previous" className="cal-month-nav">◀</Button>
                  <Button slot="next" className="cal-month-nav">▶</Button>
                </div>
                <CalendarHeading className="cal-month-heading" />
                <button
                  type="button"
                  className="cal-month-today-btn"
                  onClick={() => {
                    try {
                      setSelectedDate(today(getLocalTimeZone()));
                    } catch {
                      setSelectedDate(today("Europe/Warsaw"));
                    }
                  }}
                  title="Przejdź do dzisiejszej daty"
                >
                  Dziś
                </button>
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
                  {(date) => {
                    const hol = getPolishHoliday(date.year, date.month, date.day);
                    const isSunday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay() === 0;
                    return (
                      <CalendarCell
                        date={date}
                        className={`cal-month-cell ${hol ? "cal-month-cell--holiday" : ""} ${isSunday ? "cal-month-cell--sunday" : ""}`}
                      >
                        {({ formattedDate }) => {
                          const cellDateStr = `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
                          const dayEvents = privateMonthEvents.filter((ev) => {
                            const evEnd = ev.endDate || ev.date;
                            return cellDateStr >= ev.date && cellDateStr <= evEnd;
                          });
                          return (
                            <div className="cal-month-cell-inner">
                              <span className="cal-month-cell-num">{formattedDate}</span>
                              {dayEvents.length > 0 && (
                                <div className="cal-month-cell-bars">
                                  {dayEvents.slice(0, 3).map((ev, idx) => (
                                    <span
                                      key={ev._id || idx}
                                      className="cal-month-cell-bar"
                                      title={ev.title}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }}
                      </CalendarCell>
                    );
                  }}
                </CalendarGridBody>
              </CalendarGrid>
            </Calendar>

            {/* ─── Day View ────────────────────────────────────────────── */}
            <DayView
              selectedDate={selectedDate}
              events={Array.isArray(events) ? (events as CalEvent[]).filter(e => !e.type || e.type === "private") : []}
              onSlotClick={handleSlotClick}
              onEventClick={handleEventClick}
              onAddClick={handleAddHeaderClick}
              onEventUpdate={handleQuickUpdate}
              selectedUserIds={selectedUserIds}
              currentUserId={currentUserId}
            />
          </CalErrorBoundary>
        </div>

        {/* ─── Sliding Secondary Drawer for Add / Edit Event ────────── */}
        <EventDrawer
          isOpen={isDrawerOpen && form.type === "private"}
          form={form}
          setForm={setForm}
          selectedDate={selectedDate}
          onSave={handleSave}
          onDelete={form.mode === "edit" ? handleDelete : undefined}
          onCancel={() => setIsDrawerOpen(false)}
          saving={saving}
          currentUserId={currentUserId}
          categories={companyCategories}
          onOpenOrder={handleOpenOrder}
        />
      </aside>

      {/* Sliding Company Panel (3/4 width) */}
      <aside
        className={`cal-company-panel ${isCompanyOpen ? "cal-company-panel--open" : ""}`}
        aria-label="Kalendarz firmowy"
      >
        <div className="cal-panel-header">
          <span className="cal-panel-title">📅 Kalendarz firmowy</span>
          <button
            type="button"
            className="cal-panel-close"
            onClick={() => { setIsDrawerOpen(false); setIsCompanyOpen(false); }}
            aria-label="Zamknij kalendarz"
          >
            ✕
          </button>
        </div>

        {/* Navigation Bar */}
        <div className="cal-company-nav-bar">
          <div className="cal-month-nav-group" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div className="cal-month-nav-buttons">
              <button
                type="button"
                className="cal-month-nav"
                onClick={() => setSelectedDate(d => companyViewMode === "week" ? shiftWeek(d, -1) : shiftMonth(d, -1))}
              >
                ◀
              </button>
              <button
                type="button"
                className="cal-month-nav"
                onClick={() => setSelectedDate(d => companyViewMode === "week" ? shiftWeek(d, 1) : shiftMonth(d, 1))}
              >
                ▶
              </button>
            </div>
            
            {/* View Toggle */}
            <div className="cal-view-toggle">
              <button
                type="button"
                className={`cal-toggle-btn ${companyViewMode === "week" ? "cal-toggle-btn--active" : ""}`}
                onClick={() => setCompanyViewMode("week")}
              >
                Tydzień
              </button>
              <button
                type="button"
                className={`cal-toggle-btn ${companyViewMode === "month" ? "cal-toggle-btn--active" : ""}`}
                onClick={() => setCompanyViewMode("month")}
              >
                Miesiąc
              </button>
            </div>
          </div>
          
          <span className="cal-company-week-label">
            {companyViewMode === "week"
              ? formatWeekRangeLabel(weekDateStrings[0], weekDateStrings[6])
              : formatMonthLabel(selectedDate)}
          </span>
          
          <button
            type="button"
            className="cal-month-today-btn"
            onClick={() => setSelectedDate(d => getTodayCalendarDate(d))}
          >
            Dziś
          </button>
        </div>

        {/* Categories Filter Bar */}
        <div className="cal-company-filters">
          <div className="cal-company-filter-group">
            <span className="cal-filter-label">Filtruj kategorie</span>
            <div className="cal-category-chips">
              <button
                type="button"
                className={`cal-category-chip ${selectedCategory === "all" ? "cal-category-chip--active" : ""}`}
                style={
                  selectedCategory === "all"
                    ? {
                        borderColor: "#3b82f6",
                        color: "#ffffff",
                        background: "rgba(59, 130, 246, 0.15)",
                        boxShadow: "0 0 12px rgba(59, 130, 246, 0.2)",
                      }
                    : {
                        borderColor: "#30363d",
                      }
                }
                onClick={() => setSelectedCategory("all")}
              >
                <span className="cal-category-chip-dot" style={{ backgroundColor: "#ffffff" }} />
                Wszystkie
              </button>
              {companyCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`cal-category-chip ${selectedCategory === cat.id ? "cal-category-chip--active" : ""}`}
                  style={
                    selectedCategory === cat.id
                      ? {
                          borderColor: cat.color,
                          color: "#ffffff",
                          background: `${cat.color}25`,
                          boxShadow: `0 0 12px ${cat.color}20`,
                        }
                      : {
                          borderColor: "#30363d",
                        }
                  }
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <span className="cal-category-chip-dot" style={{ backgroundColor: cat.color }} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Company Calendar Body */}
        <div className="cal-company-body">
          <CalErrorBoundary>
            {companyViewMode === "month" ? (
              <div className="cal-monthly-grid-container">
                {/* Headers */}
                <div className="cal-monthly-headers">
                  {["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Niedz"].map((dayName) => (
                    <div key={dayName} className="cal-monthly-header-cell">
                      {dayName}
                    </div>
                  ))}
                </div>

                {/* Days Grid */}
                <div ref={monthGridRef} className="cal-monthly-days-grid">
                  {monthGridDays.map((dayStr) => {
                    const [, m, d] = dayStr.split("-").map(Number);
                    const isTodayStr = dayStr === dateToString(today(getLocalTimeZone()));
                    const isCurrentMonth = m === selectedDate.month;
                    
                    // Filter events for this day
                    const dayEvents = Array.isArray(companyEvents) ? (companyEvents as CalEvent[]).filter((ev) => {
                      const isDraggingThis = compDragState?.eventId === ev._id;
                      const eventDate = isDraggingThis ? compDragState.currentDate : ev.date;
                      const eventEndDate = isDraggingThis ? (compDragState.currentEndDate || compDragState.currentDate) : (ev.endDate || ev.date);
                      if (dayStr < eventDate || dayStr > eventEndDate) return false;
                      if (selectedCategory !== "all" && ev.category !== selectedCategory) return false;
                      return true;
                    }) : [];

                    // Sort day events by start time
                    dayEvents.sort((a, b) => a.startTime.localeCompare(b.startTime));

                    const [y] = dayStr.split("-").map(Number);
                    const hol = getPolishHoliday(y, m, d);
                    const isSunday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;

                    return (
                      <div
                        key={dayStr}
                        className={`cal-monthly-day-cell ${!isCurrentMonth ? "cal-monthly-day-cell--outside" : ""} ${isTodayStr ? "cal-monthly-day-cell--today" : ""} ${hol ? "cal-monthly-day-cell--holiday" : ""} ${isSunday ? "cal-monthly-day-cell--sunday" : ""}`}
                        title={hol || undefined}
                        onClick={(e) => {
                          if (compDragState || suppressCompanyClickRef.current) return;
                          const target = e.target as HTMLElement;
                          if (!target.closest(".cal-monthly-event-pill") && !target.closest(".cal-monthly-more-events")) {
                            handleCompanyAddClick(dayStr);
                          }
                        }}
                      >
                        <div className="cal-monthly-day-cell-header" style={{ justifyContent: hol ? "space-between" : "flex-end" }}>
                          {hol && (
                            <span className="cal-monthly-holiday-label" title={hol}>
                              {hol}
                            </span>
                          )}
                          <span className={`cal-monthly-day-number ${isTodayStr ? "cal-monthly-day-number--today" : ""} ${hol ? "cal-monthly-day-number--holiday" : ""} ${isSunday ? "cal-monthly-day-number--sunday" : ""}`}>
                            {d}
                          </span>
                        </div>
                        <div className="cal-monthly-day-events">
                          {dayEvents.slice(0, 3).map((ev) => {
                            const cat = getCategoryStyle(ev.category);
                            const isDraggingThis = compDragState?.eventId === ev._id;
                            return (
                              <button
                                key={ev._id}
                                type="button"
                                className={`cal-monthly-event-pill ${isDraggingThis ? "cal-monthly-event-pill--dragging" : ""}`}
                                style={{
                                  background: cat.bg,
                                  borderLeft: `2.5px solid ${cat.color}`,
                                  color: cat.color,
                                  touchAction: "none",
                                  position: "relative"
                                }}
                                onPointerDown={(e) => {
                                  if ((e.target as HTMLElement).closest(".cal-monthly-event-resize-handle")) return;
                                  const startH = parseHour(ev.startTime);
                                  const endH = parseHour(ev.endTime);
                                  setCompDragState({
                                    type: "month-move",
                                    eventId: ev._id,
                                    originalDate: ev.date,
                                    originalEndDate: ev.endDate || ev.date,
                                    originalStart: startH,
                                    originalEnd: endH,
                                    currentDate: ev.date,
                                    currentEndDate: ev.endDate || ev.date,
                                    currentStart: startH,
                                    currentEnd: endH,
                                    grabOffsetY: 0,
                                    grabOffsetX: 0,
                                    didMove: false,
                                  });
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!suppressCompanyClickRef.current) {
                                    handleCompanyEventClick(ev);
                                  }
                                }}
                                title={`${ev.startTime} ${ev.title}`}
                              >
                                {ev.isAllDay ? (
                                  <span className="cal-monthly-event-pill-time">Cały dzień</span>
                                ) : (
                                  <span className="cal-monthly-event-pill-time">{ev.startTime}</span>
                                )}
                                <span className="cal-monthly-event-pill-title">{ev.orderId ? "🔗 " : ""}{ev.title}</span>
                                {!isDraggingThis && ev.type === "company" && dayStr === (ev.endDate || ev.date) && (
                                  <div
                                    className="cal-monthly-event-resize-handle"
                                    style={{
                                      position: "absolute",
                                      right: 0,
                                      top: 0,
                                      bottom: 0,
                                      width: "12px",
                                      cursor: "ew-resize",
                                    }}
                                    onPointerDown={(e) => {
                                      e.stopPropagation();
                                      const startH = parseHour(ev.startTime);
                                      const endH = parseHour(ev.endTime);
                                      setCompDragState({
                                        type: "month-resize",
                                        eventId: ev._id,
                                        originalDate: ev.date,
                                        originalEndDate: ev.endDate || ev.date,
                                        originalStart: startH,
                                        originalEnd: endH,
                                        currentDate: ev.date,
                                        currentEndDate: ev.endDate || ev.date,
                                        currentStart: startH,
                                        currentEnd: endH,
                                        grabOffsetY: 0,
                                        grabOffsetX: 0,
                                        didMove: false,
                                      });
                                    }}
                                  />
                                )}
                              </button>
                            );
                          })}
                          {dayEvents.length > 3 && (
                            <div className="cal-monthly-more-events">
                              + {dayEvents.length - 3} więcej
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="cal-weekly-scroll-container">
                {/* Day Headers (sticky at the top) */}
                <div className="cal-weekly-header-row">
                  <div className="cal-weekly-hour-label-spacer" />
                  {weekDateStrings.map((dayStr) => {
                    const { dayName, dateNum, monthName } = formatWeekDayHeader(dayStr);
                    const isTodayStr = dayStr === dateToString(today(getLocalTimeZone()));
                    const [y, m, d] = dayStr.split("-").map(Number);
                    const hol = getPolishHoliday(y, m, d);
                    const isSunday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
                    return (
                      <div
                        key={dayStr}
                        className={`cal-weekly-day-header ${isTodayStr ? "cal-weekly-day-header--today" : ""} ${hol ? "cal-weekly-day-header--holiday" : ""} ${isSunday ? "cal-weekly-day-header--sunday" : ""}`}
                      >
                        <span className="cal-week-day-name">{dayName}</span>
                        <span className="cal-week-date-label-wrapper">
                          <span className={`cal-week-date-number ${isTodayStr ? "cal-week-date-number--today" : ""}`}>
                            {dateNum}
                          </span>
                          <span className="cal-week-date-month">{monthName}</span>
                        </span>
                        {hol && (
                          <span className="cal-week-holiday-tag" title={hol}>
                            {hol}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* All-day and Multi-day Tray */}
                <div className="cal-weekly-allday-tray" style={{ display: "grid", gridTemplateColumns: "54px repeat(7, 1fr)", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)", position: "sticky", top: "72px", zIndex: 30, minHeight: "32px", paddingBottom: "4px" }}>
                  <div className="cal-weekly-allday-label" style={{ borderRight: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "var(--text-muted)", padding: "4px" }}>Cały dzień</div>
                  <div style={{ gridColumn: "2 / -1", position: "relative", display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0", minHeight: "28px" }}>
                    {/* Background day slots */}
                    {weekDateStrings.map((dayStr, i) => (
                      <div key={dayStr} style={{ borderRight: i < 6 ? "1px solid var(--border-subtle)" : "none" }} />
                    ))}
                    {/* Events */}
                    {(() => {
                      const allDayEvs = Array.isArray(companyEvents) ? (companyEvents as CalEvent[]).filter(ev => {
                        if (selectedCategory !== "all" && ev.category !== selectedCategory) return false;
                        const evEnd = ev.endDate || ev.date;
                        return ev.isAllDay || ev.date !== evEnd;
                      }) : [];
                      
                      // For simplicity, we just stack them. A real algorithm would pack them vertically without overlap.
                      // We will use a simple stacking: assign rows.
                      const rows: CalEvent[][] = [];
                      for (const ev of allDayEvs) {
                        const startIdx = Math.max(0, weekDateStrings.indexOf(ev.date));
                        const endIdx = ev.endDate ? Math.min(6, weekDateStrings.indexOf(ev.endDate)) : startIdx;
                        if (startIdx === -1 && ev.date > weekDateStrings[6]) continue;
                        if (endIdx === -1 && (ev.endDate || ev.date) < weekDateStrings[0]) continue;
                        
                        const actualStart = startIdx === -1 ? 0 : startIdx;
                        const actualEnd = endIdx === -1 ? 6 : endIdx;
                        
                        let placed = false;
                        for (const row of rows) {
                          const conflict = row.some(r => {
                            const rStart = Math.max(0, weekDateStrings.indexOf(r.date));
                            const rEnd = r.endDate ? Math.min(6, weekDateStrings.indexOf(r.endDate)) : rStart;
                            return !(actualEnd < rStart || actualStart > rEnd);
                          });
                          if (!conflict) {
                            row.push(ev);
                            placed = true;
                            break;
                          }
                        }
                        if (!placed) rows.push([ev]);
                      }

                      return rows.flatMap((row, rowIndex) => row.map(ev => {
                        let startIdx = weekDateStrings.indexOf(ev.date);
                        let endIdx = ev.endDate ? weekDateStrings.indexOf(ev.endDate) : startIdx;
                        if (startIdx === -1 && ev.date < weekDateStrings[0]) startIdx = 0;
                        if (endIdx === -1 && (ev.endDate || ev.date) > weekDateStrings[6]) endIdx = 6;
                        
                        const colStart = startIdx + 1;
                        const colSpan = endIdx - startIdx + 1;
                        const cat = getCategoryStyle(ev.category);
                        
                        return (
                          <button
                            key={ev._id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!suppressCompanyClickRef.current) handleCompanyEventClick(ev);
                            }}
                            style={{
                              gridColumn: `${colStart} / span ${colSpan}`,
                              gridRow: rowIndex + 1,
                              background: cat.color,
                              color: "#fff",
                              borderRadius: "4px",
                              margin: "2px 4px",
                              padding: "2px 6px",
                              fontSize: "11px",
                              textAlign: "left",
                              border: "none",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              height: "20px",
                              display: "flex",
                              alignItems: "center",
                              position: "relative"
                            }}
                          >
                            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</span>
                            {ev.type === "company" && (
                              <div
                                style={{
                                  position: "absolute",
                                  right: 0,
                                  top: 0,
                                  bottom: 0,
                                  width: "8px",
                                  cursor: "ew-resize",
                                }}
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  const startH = parseHour(ev.startTime);
                                  const endH = parseHour(ev.endTime);
                                  setCompDragState({
                                    type: "allday-resize",
                                    eventId: ev._id,
                                    originalDate: ev.date,
                                    originalEndDate: ev.endDate || ev.date,
                                    originalStart: startH,
                                    originalEnd: endH,
                                    currentDate: ev.date,
                                    currentEndDate: ev.endDate || ev.date,
                                    currentStart: startH,
                                    currentEnd: endH,
                                    grabOffsetY: 0,
                                    grabOffsetX: 0,
                                    didMove: false,
                                  });
                                }}
                              />
                            )}
                          </button>
                        );
                      }));
                    })()}
                  </div>
                </div>

                {/* Grid content (scrollable vertically) */}
                <div ref={weekGridRef} className="cal-weekly-grid-content" style={{ height: HOURS.length * HOUR_HEIGHT }}>
                  {/* Left side: Hour labels */}
                  <div className="cal-weekly-hour-column">
                    {HOURS.map((h) => (
                      <div key={h} className="cal-weekly-hour-label-slot" style={{ height: HOUR_HEIGHT }}>
                        <span>{String(h).padStart(2, "0")}:00</span>
                      </div>
                    ))}
                  </div>

                  {/* Columns for each day */}
                  <div className="cal-weekly-columns-container">
                    {weekDateStrings.map((dayStr) => {
                      const isTodayStr = dayStr === dateToString(today(getLocalTimeZone()));
                      const [y, m, d] = dayStr.split("-").map(Number);
                      const hol = getPolishHoliday(y, m, d);
                      const isSunday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
                      
                      // Filter timed events for this day
                      const dayEvents = Array.isArray(companyEvents) ? (companyEvents as CalEvent[]).filter((ev) => {
                        const eventDate = compDragState?.eventId === ev._id ? compDragState.currentDate : ev.date;
                        if (eventDate !== dayStr) return false;
                        if (selectedCategory !== "all" && ev.category !== selectedCategory) return false;
                        const evEnd = ev.endDate || ev.date;
                        if (ev.isAllDay || ev.date !== evEnd) return false; // Already in all-day tray
                        return true;
                      }) : [];

                      // Sort day events by start time
                      dayEvents.sort((a, b) => {
                        const startA = compDragState?.eventId === a._id ? compDragState.currentStart : parseHour(a.startTime);
                        const startB = compDragState?.eventId === b._id ? compDragState.currentStart : parseHour(b.startTime);
                        return startA - startB;
                      });

                      // Pack day events
                      const { clusters: dayClusters } = packEvents(dayEvents);

                      return (
                        <div
                          key={dayStr}
                          className={`cal-weekly-day-column ${isTodayStr ? "cal-weekly-day-column--today" : ""} ${hol ? "cal-weekly-day-column--holiday" : ""} ${isSunday ? "cal-weekly-day-column--sunday" : ""}`}
                          style={{ height: HOURS.length * HOUR_HEIGHT }}
                        >
                          {/* Hour slot background grids */}
                          {HOURS.map((h) => (
                            <div
                              key={h}
                              className="cal-weekly-day-hour-slot"
                              style={{ height: HOUR_HEIGHT, touchAction: "none" }}
                              onClick={() => {
                                if (!compDragState && !compCreateDrag && !suppressCompanyClickRef.current) {
                                  handleCompanyAddClick(dayStr, h);
                                }
                              }}
                              onPointerDown={(e) => {
                                if (compDragState) return;
                                if (e.button !== 0) return; // Left click only

                                const rect = e.currentTarget.getBoundingClientRect();
                                const relativeY = e.clientY - rect.top;
                                const clickedHalf = relativeY >= HOUR_HEIGHT / 2 ? 0.5 : 0;
                                const startHour = h + clickedHalf;

                                setCompCreateDrag({
                                  dayStr,
                                  startHour,
                                  currentHour: startHour,
                                });
                              }}
                            />
                          ))}

                          {/* Absolutely positioned events */}
                          {dayEvents.map((ev) => {
                            const isDraggingThis = compDragState?.eventId === ev._id;
                            const startH = isDraggingThis ? compDragState.currentStart : parseHour(ev.startTime);
                            const endH = isDraggingThis ? compDragState.currentEnd : parseHour(ev.endTime);
                            const top = (startH - 8) * HOUR_HEIGHT;
                            const height = Math.max((endH - startH) * HOUR_HEIGHT, 28);
                            const cat = getCategoryStyle(ev.category);

                            const cluster = dayClusters.find((c) => c.events.some((e) => e._id === ev._id));
                            const colIdx = cluster?.positions.get(ev._id) ?? 0;
                            const maxCols = cluster?.maxCols ?? 1;

                            const leftStyle = `calc(4px + ${colIdx} * (100% - 8px) / ${maxCols})`;
                            const widthStyle = `calc((100% - 8px) / ${maxCols} - 2px)`;

                            return (
                              <button
                                key={ev._id}
                                type="button"
                                className={`cal-weekly-event-card ${isDraggingThis ? "cal-weekly-event-card--dragging" : ""}`}
                                style={{
                                  top,
                                  height,
                                  left: leftStyle,
                                  width: widthStyle,
                                  background: cat.bg,
                                  border: `1px solid ${cat.border}`,
                                  borderLeft: `4px solid ${cat.color}`,
                                  touchAction: "none",
                                }}
                                onPointerDown={(e) => {
                                  if ((e.target as HTMLElement).closest(".cal-event-resize-handle")) return;

                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const startVal = parseHour(ev.startTime);
                                  const endVal = parseHour(ev.endTime);

                                  setCompDragState({
                                    type: "move",
                                    eventId: ev._id,
                                    originalDate: ev.date,
                                    originalStart: startVal,
                                    originalEnd: endVal,
                                    currentDate: ev.date,
                                    currentStart: startVal,
                                    currentEnd: endVal,
                                    grabOffsetY: e.clientY - rect.top,
                                    grabOffsetX: e.clientX - rect.left,
                                    didMove: false,
                                  });
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!suppressCompanyClickRef.current) {
                                    handleCompanyEventClick(ev);
                                  }
                                }}
                              >
                                <div className="cal-weekly-event-time" style={{ color: cat.color }}>
                                  {isDraggingThis ? `${formatHour(startH)} - ${formatHour(endH)}` : `${ev.startTime} - ${ev.endTime}`}
                                </div>
                                <div className="cal-weekly-event-title">{ev.orderId ? "🔗 " : ""}{ev.title}</div>
                                {height > 40 && ev.description && (
                                  <div className="cal-weekly-event-desc">{ev.description}</div>
                                )}
                                {!isDraggingThis && (
                                  <div
                                    className="cal-event-resize-handle"
                                    onPointerDown={(e) => {
                                      const startVal = parseHour(ev.startTime);
                                      const endVal = parseHour(ev.endTime);
                                      setCompDragState({
                                        type: "resize",
                                        eventId: ev._id,
                                        originalDate: ev.date,
                                        originalStart: startVal,
                                        originalEnd: endVal,
                                        currentDate: ev.date,
                                        currentStart: startVal,
                                        currentEnd: endVal,
                                        grabOffsetY: 0,
                                        grabOffsetX: 0,
                                        didMove: false,
                                      });
                                      e.stopPropagation();
                                    }}
                                  >
                                    <div className="cal-event-resize-bar" />
                                  </div>
                                )}
                              </button>
                            );
                          })}

                          {/* Preview drag-create block (Company Calendar) */}
                          {compCreateDrag?.dayStr === dayStr && (() => {
                            const minHour = Math.min(compCreateDrag.startHour, compCreateDrag.currentHour);
                            const maxHour = Math.max(compCreateDrag.startHour, compCreateDrag.currentHour);
                            const top = (minHour - 8) * HOUR_HEIGHT;
                            const duration = maxHour - minHour;
                            const finalDuration = duration === 0 ? 0.5 : duration;
                            const height = finalDuration * HOUR_HEIGHT;
                            
                            return (
                              <div
                                className="cal-weekly-event-card"
                                style={{
                                  top,
                                  height,
                                  left: "4px",
                                  width: "calc(100% - 8px)",
                                  background: "rgba(37, 99, 235, 0.12)",
                                  border: "1px dashed rgba(37, 99, 235, 0.5)",
                                  borderLeft: "4px solid #2563eb",
                                  opacity: 0.8,
                                  pointerEvents: "none",
                                  zIndex: 5,
                                }}
                              >
                                <div className="cal-weekly-event-time" style={{ color: "#2563eb" }}>
                                  {formatHour(minHour)} - {formatHour(minHour + finalDuration)}
                                </div>
                                <div className="cal-weekly-event-title" style={{ fontStyle: "italic", opacity: 0.7 }}>
                                  Nowe wydarzenie...
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CalErrorBoundary>
        </div>

        {/* ─── Sliding Secondary Drawer for Add / Edit Event (Company) ─── */}
        <EventDrawer
          isOpen={isDrawerOpen && form.type === "company"}
          form={form}
          setForm={setForm}
          selectedDate={selectedDate}
          onSave={handleSave}
          onDelete={form.mode === "edit" ? handleDelete : undefined}
          onCancel={() => setIsDrawerOpen(false)}
          saving={saving}
          currentUserId={currentUserId}
          categories={companyCategories}
          onOpenOrder={handleOpenOrder}
        />
      </aside>

      <TaskDrawer
        isOpen={isTaskDrawerOpen}
        onClose={() => setIsTaskDrawerOpen(false)}
        users={allUsers}
        form={taskForm}
        setForm={setTaskForm}
        currentUserId={currentUserId}
      />

      {/* FAB Container */}
      <div className={`cal-fab-container ${menuExpanded ? "cal-fab-container--expanded" : ""}`}>
        {/* Company Calendar FAB */}
        <button
          type="button"
          className={`cal-fab-item cal-fab-item--company ${isCompanyOpen ? "cal-fab-item--active" : ""}`}
          onClick={() => {
            setIsCompanyOpen((v) => !v);
            setOpen(false);
            setMenuExpanded(false);
          }}
          aria-label="Otwórz kalendarz firmowy"
          aria-expanded={isCompanyOpen}
          title="Kalendarz firmowy"
        >
          <Building2 className="cal-fab-icon" style={{ strokeWidth: 1.5, filter: "none", color: "#fff" }} />
        </button>

        {/* Tasks Link FAB */}
        <button
          type="button"
          className="cal-fab-item cal-fab-item--tasks"
          onClick={() => {
            setOpen(false);
            setIsCompanyOpen(false);
            setMenuExpanded(false);
            setTaskForm({ title: "", description: "", assigneeIds: [], dueDate: "" });
            setIsTaskDrawerOpen(true);
          }}
          aria-label="Utwórz zadanie"
          title="Zadania"
        >
          <CheckSquare className="cal-fab-icon" style={{ strokeWidth: 1.5, filter: "none", color: "#fff" }} />
        </button>

        {/* Private Calendar FAB */}
        <button
          type="button"
          className={`cal-fab-item cal-fab-item--private ${open ? "cal-fab-item--active" : ""}`}
          onClick={() => {
            setOpen((v) => !v);
            setIsCompanyOpen(false);
            setMenuExpanded(false);
          }}
          aria-label="Otwórz kalendarz prywatny"
          aria-expanded={open}
          title="Kalendarz prywatny"
        >
          <CalendarDays className="cal-fab-icon" style={{ strokeWidth: 1.5, filter: "none", color: "#fff" }} />
        </button>

        {/* Trigger FAB (Primary Base) */}
        <button
          type="button"
          className={`cal-fab-item cal-fab-item--trigger ${menuExpanded ? "cal-fab-item--active" : ""}`}
          onClick={() => {
            setMenuExpanded((v) => !v);
          }}
          aria-label="Otwórz nawigację kalendarzy"
          title="Kalendarz i narzędzia"
        >
          <Plus
            className="cal-fab-icon cal-fab-trigger-icon"
            style={{ width: "32px", height: "32px", color: "#ffffff", strokeWidth: 1.5, transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
          />
        </button>
      </div>

      <style>{`
        /* ─── Typography & Container (Geist Sans / Modern Sans) ──── */
        .cal-panel,
        .cal-company-panel,
        .cal-drawer,
        .cal-panel *,
        .cal-company-panel * {
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
          bottom: 0;
          width: 400px;
          max-width: 100vw;
          z-index: 50;
          background: #111419;
          border-left: 1px solid #282e37;
          box-shadow: -10px 0 36px rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
          right: -400px;
          transition: right 0.28s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }

        .cal-panel--open {
          right: 0;
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

        .cal-month-nav-group {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .cal-month-today-btn {
          background: rgba(212, 29, 60, 0.15);
          color: #ff7b90;
          border: 1px solid rgba(212, 29, 60, 0.35);
          font-size: 11.5px;
          font-weight: 600;
          padding: 5px 11px;
          border-radius: 7px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .cal-month-today-btn:hover {
          background: #d41d3c;
          color: #ffffff;
          border-color: #d41d3c;
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

        .cal-month-cell--holiday > span,
        .cal-month-cell--holiday,
        .cal-month-cell--sunday > span,
        .cal-month-cell--sunday {
          color: #ff7b72 !important;
        }

        .cal-month-cell--holiday {
          position: relative;
        }

        .cal-month-cell--holiday::after {
          content: '';
          position: absolute;
          top: 3px;
          right: 3px;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background-color: #ff7b72;
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

        .cal-month-cell-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          width: 100%;
          height: 100%;
          padding-top: 5px;
          position: relative;
        }

        .cal-month-cell-num {
          line-height: 14px;
          font-size: 13.5px;
        }

        .cal-month-cell-bars {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          width: 18px;
          margin-top: 3px;
        }

        .cal-month-cell-bar {
          width: 100%;
          height: 2.5px;
          border-radius: 1.5px;
          background-color: #d41d3c;
          flex-shrink: 0;
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

        .cal-month-cell[data-selected] .cal-month-cell-bar {
          background-color: #ffffff;
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
          width: calc(100% - 58px);
          border-radius: 7px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-left: 4px solid #d41d3c;
          padding: 5px 10px 10px;
          cursor: grab;
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
          text-align: left;
          transition: filter 0.15s, transform 0.15s;
          z-index: 2;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          user-select: none;
        }

        .cal-event-block:hover {
          filter: brightness(1.18);
        }

        .cal-event-block--dragging {
          cursor: grabbing !important;
          z-index: 10 !important;
          filter: brightness(1.25);
          box-shadow: 0 10px 28px rgba(0,0,0,0.6) !important;
          opacity: 0.92;
        }

        .cal-event-resize-handle {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 9px;
          cursor: ns-resize;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 5;
        }

        .cal-event-resize-bar {
          width: 28px;
          height: 3px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.25);
          transition: background 0.15s;
        }

        .cal-event-resize-handle:hover .cal-event-resize-bar {
          background: rgba(255, 255, 255, 0.75);
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
          position: fixed;
          top: 0;
          bottom: 0;
          width: 400px;
          max-width: 100vw;
          z-index: 51;
          background: #111419;
          border-left: 1px solid #282e37;
          box-shadow: -10px 0 36px rgba(0, 0, 0, 0.4);
          display: flex;
          flex-direction: column;
          right: -400px;
          visibility: hidden;
          transition: right 0.3s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.3s;
        }

        .cal-drawer--open {
          right: 0;
          visibility: visible;
          transition: right 0.3s cubic-bezier(0.16, 1, 0.3, 1);
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
          color-scheme: dark;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .cal-input[type="date"] {
          position: relative;
          cursor: pointer;
        }

        .cal-input::-webkit-calendar-picker-indicator {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
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

        /* ─── Company Panel ───────────────────────────────────────── */
        .cal-company-panel {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 75vw;
          max-width: 100vw;
          z-index: 50;
          background: #111419;
          border-left: 1px solid #282e37;
          box-shadow: -10px 0 36px rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
          right: -75vw;
          transition: right 0.32s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }

        .cal-company-panel--open {
          right: 0;
        }

        .cal-company-nav-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          border-bottom: 1px solid #21262d;
          background: #14181f;
          flex-shrink: 0;
        }

        .cal-company-week-label {
          font-size: 15px;
          font-weight: 600;
          color: #f0f6fc;
          letter-spacing: -0.01em;
        }

        .cal-company-filters {
          padding: 12px 20px;
          border-bottom: 1px solid #21262d;
          background: #0d1117;
          display: flex;
          align-items: center;
          gap: 16px;
          flex-shrink: 0;
        }

        .cal-company-filter-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .cal-category-chips {
          display: flex;
          gap: 10px;
        }

        .cal-category-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 6px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          color: #c9d1d9;
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .cal-category-chip:hover {
          background: #21262d;
          color: #ffffff;
          border-color: #8b949e;
        }

        .cal-category-chip-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }

        .cal-company-body {
          flex: 1;
          background: #0d1117;
          display: flex;
          overflow: hidden;
        }

        /* ─── Weekly Grid Layout ─── */
        .cal-weekly-scroll-container {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow-y: auto;
          overflow-x: auto;
          background: #0d1117;
          min-width: 900px;
        }

        .cal-weekly-header-row {
          display: flex;
          position: sticky;
          top: 0;
          z-index: 10;
          background: #14181f;
          border-bottom: 1px solid #21262d;
          flex-shrink: 0;
        }

        .cal-weekly-hour-label-spacer {
          width: 54px;
          flex-shrink: 0;
          border-right: 1px solid #21262d;
        }

        .cal-weekly-day-header {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 10px 4px;
          border-right: 1px solid #282e37;
          background: #161b22;
          min-width: 120px;
        }

        .cal-weekly-day-header--holiday,
        .cal-weekly-day-header--sunday {
          background: #1b1215;
        }

        .cal-weekly-day-header--holiday .cal-week-day-name,
        .cal-weekly-day-header--sunday .cal-week-day-name {
          color: #ff7b72;
        }

        .cal-weekly-day-header--holiday .cal-week-date-number,
        .cal-weekly-day-header--sunday .cal-week-date-number {
          color: #ff7b72;
        }

        .cal-week-holiday-tag {
          font-size: 9px;
          font-weight: 600;
          color: #ff7b72;
          background: rgba(255, 123, 114, 0.12);
          border: 1px solid rgba(255, 123, 114, 0.3);
          border-radius: 4px;
          padding: 1px 4px;
          margin-top: 4px;
          max-width: 95%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cal-weekly-day-header:last-child {
          border-right: none;
        }

        .cal-weekly-day-header--today {
          background: #1d2430;
          border-bottom: 2px solid #2563eb;
        }

        .cal-week-day-name {
          font-size: 11px;
          font-weight: 700;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 6px;
        }

        .cal-weekly-day-header--today .cal-week-day-name {
          color: #3b82f6;
        }

        .cal-week-date-label-wrapper {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .cal-week-date-number {
          font-size: 16px;
          font-weight: 700;
          color: #ffffff;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s;
        }

        .cal-week-date-number--today {
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 0 10px rgba(37, 99, 235, 0.4);
        }

        .cal-week-date-month {
          font-size: 13px;
          font-weight: 500;
          color: #8b949e;
        }

        .cal-weekly-grid-content {
          display: flex;
          position: relative;
          flex: 1;
        }

        .cal-weekly-hour-column {
          width: 54px;
          flex-shrink: 0;
          border-right: 1px solid #21262d;
          background: #14181f;
          display: flex;
          flex-direction: column;
        }

        .cal-weekly-hour-label-slot {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          font-size: 11px;
          font-weight: 500;
          color: #7d8590;
          padding-top: 6px;
          user-select: none;
          border-bottom: 1px solid #1f242c;
        }

        .cal-weekly-columns-container {
          display: flex;
          flex: 1;
          position: relative;
        }

        .cal-weekly-day-column {
          flex: 1;
          position: relative;
          border-right: 1px solid #21262d;
          background: #111419;
          min-width: 120px;
        }

        .cal-weekly-day-column--holiday,
        .cal-weekly-day-column--sunday {
          background: rgba(255, 123, 114, 0.02) !important;
        }

        .cal-weekly-day-column:last-child {
          border-right: none;
        }

        .cal-weekly-day-column--today {
          background: rgba(37, 99, 235, 0.01);
        }

        .cal-weekly-day-hour-slot {
          border-bottom: 1px solid #1f242c;
          cursor: pointer;
          transition: background 0.12s;
        }

        .cal-weekly-day-hour-slot:hover {
          background: rgba(255, 255, 255, 0.025);
        }

        .cal-weekly-event-card {
          position: absolute;
          border-radius: 6px;
          padding: 6px 8px;
          cursor: pointer;
          transition: filter 0.15s, transform 0.12s;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
          z-index: 2;
        }

        .cal-weekly-event-card:hover {
          filter: brightness(1.18);
          transform: translateY(-1px);
        }

        .cal-weekly-event-time {
          font-size: 10px;
          font-weight: 700;
        }

        .cal-weekly-event-title {
          font-size: 11.5px;
          font-weight: 600;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cal-weekly-event-desc {
          font-size: 10.5px;
          color: #8b949e;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cal-weekly-event-card--dragging {
          opacity: 0.75;
          z-index: 100 !important;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5) !important;
          transform: scale(1.02);
        }

        .cal-weekly-event-resize-handle {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 8px;
          cursor: ns-resize;
          background: transparent;
          z-index: 10;
        }

        .cal-weekly-event-card:hover .cal-weekly-event-resize-handle {
          background: rgba(255, 255, 255, 0.15);
        }

        .cal-monthly-event-pill--dragging {
          opacity: 0.75;
          z-index: 100 !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
          transform: scale(1.04);
        }

        /* ─── FAB Container & Hover Anims ────────────────────────── */
        .cal-fab-container {
          position: fixed;
          bottom: 28px;
          right: 28px;
          z-index: 48;
          width: 52px;
          height: 52px;
          transition: height 0s;
        }

        .cal-fab-container:hover,
        .cal-fab-container--expanded {
          height: 260px;
        }

        .cal-fab-item {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4);
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .cal-fab-item--trigger {
          background: #d41d3c;
          box-shadow: 0 4px 18px rgba(212, 29, 60, 0.5);
          z-index: 5;
        }

        .cal-fab-item--trigger:hover {
          background: #e63350;
          transform: scale(1.06);
          box-shadow: 0 6px 24px rgba(212, 29, 60, 0.65);
        }

        .cal-fab-item--trigger .cal-fab-trigger-icon {
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .cal-fab-container:hover .cal-fab-item--trigger .cal-fab-trigger-icon,
        .cal-fab-container--expanded .cal-fab-item--trigger .cal-fab-trigger-icon {
          transform: rotate(45deg);
        }

        /* Private Calendar (Circle 1) */
        .cal-fab-item--private {
          background: #d41d3c;
          box-shadow: 0 4px 18px rgba(212, 29, 60, 0.5);
          opacity: 0;
          transform: translateY(0) scale(0.6);
          pointer-events: none;
          z-index: 4;
        }

        .cal-fab-container:hover .cal-fab-item--private,
        .cal-fab-container--expanded .cal-fab-item--private {
          opacity: 1;
          transform: translateY(-132px) scale(1);
          pointer-events: auto;
        }

        .cal-fab-item--private:hover {
          background: #e63350;
          transform: translateY(-132px) scale(1.06);
          box-shadow: 0 6px 24px rgba(212, 29, 60, 0.65);
        }

        .cal-fab-item--private:active {
          transform: translateY(-132px) scale(0.95);
        }

        .cal-fab-item--private.cal-fab-item--active {
          background: #a31530;
          box-shadow: 0 4px 16px rgba(212, 29, 60, 0.35);
        }

        /* Tasks (Circle 2) */
        .cal-fab-item--tasks {
          background: #25d366;
          box-shadow: 0 4px 18px rgba(37, 211, 102, 0.4);
          opacity: 0;
          transform: translateY(0) scale(0.6);
          pointer-events: none;
          z-index: 3;
        }

        .cal-fab-container:hover .cal-fab-item--tasks,
        .cal-fab-container--expanded .cal-fab-item--tasks {
          opacity: 1;
          transform: translateY(-66px) scale(1);
          pointer-events: auto;
        }

        .cal-fab-item--tasks:hover {
          background: #20ba5a;
          transform: translateY(-66px) scale(1.06);
          box-shadow: 0 6px 24px rgba(37, 211, 102, 0.55);
        }

        .cal-fab-item--tasks:active {
          transform: translateY(-66px) scale(0.95);
        }

        /* Company Calendar (Circle 3) */
        .cal-fab-item--company {
          background: #2563eb;
          box-shadow: 0 4px 18px rgba(37, 99, 235, 0.5);
          opacity: 0;
          transform: translateY(0) scale(0.6);
          pointer-events: none;
          z-index: 2;
        }

        .cal-fab-container:hover .cal-fab-item--company,
        .cal-fab-container--expanded .cal-fab-item--company {
          opacity: 1;
          transform: translateY(-198px) scale(1);
          pointer-events: auto;
        }

        .cal-fab-item--company:hover {
          background: #3b82f6;
          transform: translateY(-198px) scale(1.06);
          box-shadow: 0 6px 24px rgba(37, 99, 235, 0.65);
        }

        .cal-fab-item--company:active {
          transform: translateY(-198px) scale(0.95);
        }

        .cal-fab-item--company.cal-fab-item--active {
          background: #1d4ed8;
          box-shadow: 0 4px 16px rgba(37, 99, 235, 0.35);
        }

        .cal-fab-icon {
          filter: brightness(0) invert(1);
          pointer-events: none;
        }

        /* ─── Multi-User Filters & Columns Styles ─────────────────── */

        .cal-day-columns-header {
          display: flex;
          margin-bottom: 6px;
          border-bottom: 1px solid #21262d;
          padding-bottom: 8px;
        }

        .cal-day-column-header-title {
          text-align: center;
          font-size: 11.5px;
          font-weight: 600;
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
          padding: 0 4px;
        }

        .cal-column-divider {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: #21262d;
          pointer-events: none;
        }

        .cal-event-block--readonly {
          cursor: default !important;
        }

        /* ─── Monthly View Grid Layout ─── */
        .cal-monthly-grid-container {
          display: flex;
          flex-direction: column;
          flex: 1;
          height: 100%;
          min-width: 900px;
          background: #0d1117;
        }

        .cal-monthly-headers {
          display: flex;
          background: #14181f;
          border-bottom: 1px solid #21262d;
          flex-shrink: 0;
        }

        .cal-monthly-header-cell {
          flex: 1;
          text-align: center;
          padding: 10px 4px;
          font-size: 11px;
          font-weight: 700;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          border-right: 1px solid #282e37;
        }

        .cal-monthly-header-cell:last-child {
          border-right: none;
        }

        .cal-monthly-days-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          grid-template-rows: repeat(6, 1fr);
          flex: 1;
          background: #21262d;
          gap: 1px;
        }

        .cal-monthly-day-cell {
          background: #111419;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          cursor: pointer;
          transition: background 0.15s;
          min-height: 80px;
          overflow: hidden;
        }

        .cal-monthly-day-cell--holiday,
        .cal-monthly-day-cell--sunday {
          background: rgba(255, 123, 114, 0.015);
        }

        .cal-monthly-day-cell:hover {
          background: #161a22;
        }

        .cal-monthly-day-cell--outside {
          background: #0d0f13;
          opacity: 0.45;
        }

        .cal-monthly-day-cell--today {
          background: rgba(37, 99, 235, 0.02);
        }

        .cal-monthly-day-cell-header {
          display: flex;
          justify-content: flex-end;
          align-items: center;
        }

        .cal-monthly-day-number {
          font-size: 12px;
          font-weight: 700;
          color: #c9d1d9;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }

        .cal-monthly-day-number--holiday,
        .cal-monthly-day-number--sunday {
          color: #ff7b72 !important;
        }

        .cal-monthly-holiday-label {
          font-size: 9px;
          font-weight: 550;
          color: #ff7b72;
          background: rgba(255, 123, 114, 0.12);
          border: 1px solid rgba(255, 123, 114, 0.3);
          border-radius: 4px;
          padding: 1px 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 90px;
        }

        .cal-monthly-day-number--today {
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 0 8px rgba(37, 99, 235, 0.4);
        }

        .cal-monthly-day-events {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
          overflow: hidden;
        }

        .cal-monthly-event-pill {
          width: 100%;
          border: none;
          border-radius: 4px;
          padding: 3px 6px;
          font-size: 10.5px;
          font-weight: 600;
          cursor: pointer;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 4px;
          overflow: hidden;
          white-space: nowrap;
          transition: filter 0.15s;
        }

        .cal-monthly-event-pill:hover {
          filter: brightness(1.15);
        }

        .cal-monthly-event-pill-time {
          font-weight: 700;
          flex-shrink: 0;
        }

        .cal-monthly-event-pill-title {
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cal-monthly-more-events {
          font-size: 9.5px;
          font-weight: 700;
          color: #8b949e;
          padding-left: 4px;
          margin-top: 1px;
        }

        /* ─── Toggle Button Styling ─── */
        .cal-view-toggle {
          display: flex;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 6px;
          padding: 2px;
        }

        .cal-toggle-btn {
          background: transparent;
          border: none;
          color: #8b949e;
          font-size: 11.5px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .cal-toggle-btn:hover {
          color: #ffffff;
        }

        .cal-toggle-btn--active {
          background: #2563eb;
          color: #ffffff !important;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.35);
        }

        .cal-month-nav-buttons {
          display: flex;
          gap: 4px;
        }
      `}</style>
    </>
  );
}
