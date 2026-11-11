import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { calendarEventOccurrence, calendarMonth, makeId, type CalendarEvent, type CalendarRecurrence } from "@osunnote/domain";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const currentMonth = () => { const now = new Date(); return { year: now.getFullYear(), month: now.getMonth() + 1 }; };
const localIsoDate = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

const parseSchedulePrompt = (prompt: string, fallbackYear: number): { title: string; date: string } | undefined => {
  const value = prompt.trim();
  if (!value) return undefined;
  const relative = value.match(/^(오늘|내일)\s*/);
  if (relative) {
    const target = new Date();
    if (relative[1] === "내일") target.setDate(target.getDate() + 1);
    return { date: localIsoDate(target), title: value.slice(relative[0].length).trim() };
  }
  const match = value.match(/(?:(\d{4})년\s*)?(\d{1,2})월\s*(\d{1,2})일/);
  if (!match) return undefined;
  const year = Number(match[1] ?? fallbackYear); const month = Number(match[2]); const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return undefined;
  return { date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, title: value.replace(match[0], "").trim() };
};

interface CalendarPageProps { events: CalendarEvent[]; onChange: (events: CalendarEvent[]) => void; }

export function CalendarPage({ events, onChange }: CalendarPageProps) {
  const [visible, setVisible] = useState(currentMonth);
  const [composerOpen, setComposerOpen] = useState(false);
  const [prompt, setPrompt] = useState(""); const [title, setTitle] = useState("");
  const [date, setDate] = useState(localIsoDate(new Date()));
  const [recurrence, setRecurrence] = useState<CalendarRecurrence>("none");
  const [monthDay, setMonthDay] = useState(1); const [weekOfMonth, setWeekOfMonth] = useState(1); const [dayOfWeek, setDayOfWeek] = useState(1);
  const [adjustPreviousBusinessDay, setAdjustPreviousBusinessDay] = useState(false);
  const days = useMemo(() => calendarMonth(visible.year, visible.month), [visible]);
  const today = localIsoDate(new Date());
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    events.forEach((event) => { const occurrence = calendarEventOccurrence(event, visible.year, visible.month); if (occurrence) grouped.set(occurrence, [...(grouped.get(occurrence) ?? []), event]); });
    return grouped;
  }, [events, visible]);

  const moveMonth = (offset: number) => setVisible((current) => { const next = new Date(current.year, current.month - 1 + offset, 1); return { year: next.getFullYear(), month: next.getMonth() + 1 }; });
  const resetComposer = () => { setPrompt(""); setTitle(""); setDate(today); setRecurrence("none"); setMonthDay(1); setWeekOfMonth(1); setDayOfWeek(1); setAdjustPreviousBusinessDay(false); };
  const closeComposer = () => { setComposerOpen(false); resetComposer(); };
  const updatePrompt = (value: string) => { setPrompt(value); const parsed = parseSchedulePrompt(value, visible.year); if (parsed) { setDate(parsed.date); if (parsed.title) setTitle(parsed.title); } };
  const saveEvent = () => {
    const eventTitle = title.trim() || prompt.trim(); if (!eventTitle || !date) return;
    const now = Date.now();
    onChange([...events, { id: makeId(), title: eventTitle, date, recurrence, ...(recurrence === "monthly-day" ? { monthDay } : {}), ...(recurrence === "monthly-weekday" ? { weekOfMonth, dayOfWeek } : {}), adjustPreviousBusinessDay, createdAt: now, updatedAt: now }]);
    const [year, month] = date.split("-").map(Number); if (year && month) setVisible({ year, month }); closeComposer();
  };

  return <section className="calendar-page" aria-label="캘린더">
    <header className="calendar-page-header"><h1>{visible.year}년 {visible.month}월</h1><div className="calendar-page-controls"><button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달"><ChevronLeft /></button><button type="button" onClick={() => setVisible(currentMonth())}>오늘</button><button type="button" onClick={() => moveMonth(1)} aria-label="다음 달"><ChevronRight /></button></div><button type="button" className="calendar-add-button" onClick={() => setComposerOpen(true)}><Plus size={16} />일정 추가</button></header>
    <div className="calendar-weekdays" aria-hidden="true">{weekdays.map((name, index) => <span key={name} className={index === 0 ? "sunday" : index === 6 ? "saturday" : ""}>{name}</span>)}</div>
    <div className="calendar-grid" role="grid" aria-label={`${visible.year}년 ${visible.month}월`}>{days.map((day) => { const tone = day.holiday || day.dayOfWeek === 0 ? "holiday" : day.dayOfWeek === 6 ? "saturday" : ""; const dayEvents = eventsByDate.get(day.date) ?? []; return <article key={day.date} className={`calendar-day ${tone} ${day.inCurrentMonth ? "" : "outside"} ${day.date === today ? "today" : ""}`} role="gridcell" aria-label={`${day.date}${day.holiday ? ` ${day.holiday.name}` : ""}`}><time dateTime={day.date}>{day.day}</time>{day.holiday && <strong>{day.holiday.name}</strong>}{dayEvents.length > 0 && <div className="calendar-event-list">{dayEvents.map((event) => <span key={event.id} title={event.title}>{event.title}</span>)}</div>}</article>; })}</div>
    {composerOpen && <div className="calendar-event-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) closeComposer(); }}><form className="calendar-event-dialog" role="dialog" aria-modal="true" aria-labelledby="calendar-event-title" onSubmit={(event) => { event.preventDefault(); saveEvent(); }}><header><div><span>새 일정</span><h2 id="calendar-event-title">일정 추가</h2></div><button type="button" onClick={closeComposer} aria-label="일정 추가 닫기"><X size={17} /></button></header>
      <label htmlFor="calendar-smart-prompt">만능 프롬프트</label><input id="calendar-smart-prompt" value={prompt} onChange={(event) => updatePrompt(event.target.value)} placeholder="예: 11월 11일 빼빼로사야됨" autoFocus /><small>날짜가 포함된 문장을 입력하면 일정 내용과 날짜를 자동으로 채웁니다.</small>
      <label htmlFor="calendar-event-content">일정 내용</label><input id="calendar-event-content" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="일정 내용을 입력하세요" />
      <label htmlFor="calendar-event-date">날짜</label><input id="calendar-event-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
      <label htmlFor="calendar-event-repeat">반복 일정</label><select id="calendar-event-repeat" value={recurrence} onChange={(event) => setRecurrence(event.target.value as CalendarRecurrence)}><option value="none">반복 안 함</option><option value="monthly-day">매월 지정일</option><option value="monthly-weekday">매월 지정 주·요일</option></select>
      {recurrence === "monthly-day" && <div className="calendar-repeat-fields"><span>매월</span><input type="number" min="1" max="31" value={monthDay} onChange={(event) => setMonthDay(Number(event.target.value))} aria-label="매월 반복 날짜" /><span>일</span></div>}
      {recurrence === "monthly-weekday" && <div className="calendar-repeat-fields"><span>매월</span><select value={weekOfMonth} onChange={(event) => setWeekOfMonth(Number(event.target.value))} aria-label="매월 반복 주"><option value="1">첫 번째 주</option><option value="2">두 번째 주</option><option value="3">세 번째 주</option><option value="4">네 번째 주</option><option value="5">다섯 번째 주</option></select><select value={dayOfWeek} onChange={(event) => setDayOfWeek(Number(event.target.value))} aria-label="반복 요일">{weekdays.map((weekday, index) => <option value={index} key={weekday}>{weekday}요일</option>)}</select></div>}
      <label className="calendar-business-checkbox" htmlFor="calendar-business-adjust"><input id="calendar-business-adjust" type="checkbox" checked={adjustPreviousBusinessDay} onChange={(event) => setAdjustPreviousBusinessDay(event.target.checked)} /><span>주말 및 공휴일 제외 (전 영업일로 당기기)</span></label>
      <footer><button type="button" onClick={closeComposer}>취소</button><button type="submit" disabled={!(title.trim() || prompt.trim()) || !date}>저장</button></footer>
    </form></div>}
  </section>;
}
