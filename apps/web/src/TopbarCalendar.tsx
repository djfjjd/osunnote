import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { calendarMonth } from "@osunnote/domain";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

const seoulDate = () => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { year: Number(value("year")), month: Number(value("month")), date: `${value("year")}-${value("month")}-${value("day")}` };
};

interface TopbarCalendarProps {
  eventDates?: Iterable<string>;
}

export function TopbarCalendar({ eventDates = [] }: TopbarCalendarProps) {
  const today = seoulDate();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState({ year: today.year, month: today.month });
  const rootRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => calendarMonth(visible.year, visible.month), [visible]);
  const eventDateSet = useMemo(() => new Set(eventDates), [eventDates]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    globalThis.document.addEventListener("pointerdown", closeOnOutside);
    globalThis.document.addEventListener("keydown", closeOnEscape);
    return () => {
      globalThis.document.removeEventListener("pointerdown", closeOnOutside);
      globalThis.document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const moveMonth = (offset: number) => setVisible((current) => {
    const date = new Date(current.year, current.month - 1 + offset, 1);
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  });

  const showToday = () => setVisible({ year: today.year, month: today.month });

  return (
    <div className="topbar-calendar" ref={rootRef}>
      <button
        type="button"
        className={`topbar-date-button ${open ? "open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => { if (!open) showToday(); setOpen((value) => !value); }}
      >
        <CalendarDays size={14} />{today.date}
      </button>
      {open && (
        <section className="topbar-calendar-popup" role="dialog" aria-modal="false" aria-label="월간 캘린더">
          <header>
            <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달"><ChevronLeft /></button>
            <button type="button" className="topbar-calendar-month" onClick={showToday}>{visible.year}년 {visible.month}월</button>
            <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달"><ChevronRight /></button>
            <button type="button" className="topbar-calendar-close" onClick={() => setOpen(false)} aria-label="캘린더 닫기"><X /></button>
          </header>
          <div className="topbar-calendar-weekdays" aria-hidden="true">
            {weekdays.map((name, index) => <span key={name} className={index === 0 ? "holiday" : index === 6 ? "saturday" : ""}>{name}</span>)}
          </div>
          <div className="topbar-calendar-grid" role="grid" aria-label={`${visible.year}년 ${visible.month}월`}>
            {days.map((day) => {
              const tone = day.holiday || day.dayOfWeek === 0 ? "holiday" : day.dayOfWeek === 6 ? "saturday" : "";
              const hasEvent = eventDateSet.has(day.date);
              return (
                <div
                  key={day.date}
                  className={`topbar-calendar-day ${tone} ${day.inCurrentMonth ? "" : "outside"} ${day.date === today.date ? "today" : ""}`}
                  role="gridcell"
                  title={day.holiday?.name}
                  aria-label={`${day.date}${day.holiday ? ` ${day.holiday.name}` : ""}${hasEvent ? " 일정 있음" : ""}`}
                >
                  <time dateTime={day.date}>{day.day}</time>
                  {hasEvent && <i className="event-dot" aria-hidden="true" />}
                </div>
              );
            })}
          </div>
          <footer><span><i className="event-dot-legend" />일정 있음</span><button type="button" onClick={showToday}>오늘로 이동</button></footer>
        </section>
      )}
    </div>
  );
}
