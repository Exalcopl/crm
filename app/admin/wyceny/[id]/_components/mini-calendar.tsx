"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { Quote } from "@/app/admin/_lib/quotes";
import { I } from "@/app/admin/_lib/icons";

type TaskDoc = Doc<"tasks">;

const DOW = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const MONTHS = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
];

const TODAY = new Date("2026-05-25");

function startOfMonth(y: number, m: number) {
  return new Date(y, m, 1);
}

function buildGrid(year: number, month: number): Date[] {
  const first = startOfMonth(year, month);
  // pl: tydzień zaczyna w poniedziałek (1) — getDay zwraca 0 dla niedzieli
  const firstDow = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - firstDow);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function isoDay(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function MiniCalendar({ quote }: { quote: Quote }) {
  const tasksRaw = useQuery(api.tasks.list, { quoteId: quote._id });
  const tasks = useMemo(
    () => (tasksRaw ?? []) as TaskDoc[],
    [tasksRaw],
  );
  const [view, setView] = useState(() => ({
    year: TODAY.getFullYear(),
    month: TODAY.getMonth(),
  }));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskDoc[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const list = map.get(t.dueDate) ?? [];
      list.push(t);
      map.set(t.dueDate, list);
    }
    return map;
  }, [tasks]);

  const deadlineIso = quote.deadline;
  const grid = buildGrid(view.year, view.month);
  const tasksForSelectedDay = selectedDay ? tasksByDay.get(selectedDay) ?? [] : [];

  function shiftMonth(delta: number) {
    setView((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  function goToday() {
    setView({ year: TODAY.getFullYear(), month: TODAY.getMonth() });
    setSelectedDay(isoDay(TODAY));
  }

  return (
    <section className="quote-detail-calendar">
      <header className="quote-detail-calendar-head">
        <div className="quote-detail-calendar-title">
          <span className="quote-detail-calendar-icon">
            <I.cal s={14} sw={2} />
          </span>
          <span>Kalendarz</span>
        </div>
        <div className="quote-detail-calendar-nav">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Poprzedni miesiąc"
            className="quote-detail-calendar-nav-btn"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goToday}
            className="quote-detail-calendar-month"
            title="Wróć do dziś"
          >
            {MONTHS[view.month]} {view.year}
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Następny miesiąc"
            className="quote-detail-calendar-nav-btn"
          >
            ›
          </button>
        </div>
      </header>

      <div className="quote-detail-calendar-dow">
        {DOW.map((d) => (
          <span key={d} className="quote-detail-calendar-dow-cell">
            {d}
          </span>
        ))}
      </div>

      <div className="quote-detail-calendar-grid">
        {grid.map((day) => {
          const iso = isoDay(day);
          const inMonth = day.getMonth() === view.month;
          const isToday = sameDay(day, TODAY);
          const isDeadline = iso === deadlineIso;
          const dayTasks = tasksByDay.get(iso) ?? [];
          const isSelected = selectedDay === iso;
          return (
            <button
              key={iso}
              type="button"
              className={`quote-detail-calendar-day${inMonth ? "" : " is-other"}${isToday ? " is-today" : ""}${isDeadline ? " is-deadline" : ""}${isSelected ? " is-selected" : ""}`}
              onClick={() => setSelectedDay(iso)}
              title={isDeadline ? "Termin oferty" : undefined}
            >
              <span className="quote-detail-calendar-day-num">{day.getDate()}</span>
              {(dayTasks.length > 0 || isDeadline) && (
                <span className="quote-detail-calendar-day-dots">
                  {isDeadline && (
                    <span className="quote-detail-calendar-dot is-deadline" />
                  )}
                  {dayTasks.slice(0, 3).map((t) => (
                    <span
                      key={t._id as unknown as string}
                      className={`quote-detail-calendar-dot is-${t.status}`}
                    />
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="quote-detail-calendar-dot-more">
                      +{dayTasks.length - 3}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedDay && (tasksForSelectedDay.length > 0 || selectedDay === deadlineIso) && (
        <div className="quote-detail-calendar-list">
          <div className="quote-detail-calendar-list-head">
            {new Date(selectedDay).toLocaleDateString("pl-PL", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </div>
          {selectedDay === deadlineIso && (
            <div className="quote-detail-calendar-list-item is-deadline">
              <span className="quote-detail-calendar-list-dot is-deadline" />
              <span>Termin oferty</span>
            </div>
          )}
          {tasksForSelectedDay.map((t) => (
            <div
              key={t._id as unknown as string}
              className="quote-detail-calendar-list-item"
            >
              <span className={`quote-detail-calendar-list-dot is-${t.status}`} />
              <span className="quote-detail-calendar-list-title">{t.title}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
