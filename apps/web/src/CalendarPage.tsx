import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { calendarMonth } from "@osunnote/domain";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

const currentMonth = () => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
};

export function CalendarPage() {
  const [visible, setVisible] = useState(currentMonth);
  const days = useMemo(() => calendarMonth(visible.year, visible.month), [visible]);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  const moveMonth = (offset: number) => setVisible((current) => {
    const date = new Date(current.year, current.month - 1 + offset, 1);
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  });

  return (
    <section className="calendar-page" aria-label="캘린더">
      <header className="calendar-page-header">
        <div><h1>{visible.year}년 {visible.month}월</h1></div>
        <div className="calendar-page-controls">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달"><ChevronLeft /></button>
          <button type="button" onClick={() => setVisible(currentMonth())}>오늘</button>
          <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달"><ChevronRight /></button>
        </div>
      </header>
      <div className="calendar-weekdays" aria-hidden="true">
        {weekdays.map((name, index) => <span key={name} className={index === 0 ? "sunday" : index === 6 ? "saturday" : ""}>{name}</span>)}
      </div>
      <div className="calendar-grid" role="grid" aria-label={`${visible.year}년 ${visible.month}월`}>
        {days.map((day) => {
          const tone = day.holiday || day.dayOfWeek === 0 ? "holiday" : day.dayOfWeek === 6 ? "saturday" : "";
          return (
            <article
              key={day.date}
              className={`calendar-day ${tone} ${day.inCurrentMonth ? "" : "outside"} ${day.date === today ? "today" : ""}`}
              role="gridcell"
              aria-label={`${day.date}${day.holiday ? ` ${day.holiday.name}` : ""}`}
            >
              <time dateTime={day.date}>{day.day}</time>
              {day.holiday && <strong>{day.holiday.name}</strong>}
            </article>
          );
        })}
      </div>
      <footer className="calendar-source"><CalendarDays size={14} />대한민국 공휴일 · 2026년 우주항공청 월력요항 기준</footer>
    </section>
  );
}
