import { ArrowRight, BookOpen, CalendarDays, FilePlus2, PenLine } from "lucide-react";
import { countCharacters, type Project, type WritingDocument } from "@osunnote/domain";
import { ko } from "./i18n";

interface HomePageProps {
  project: Project;
  documents: WritingDocument[];
  onNewDocument: () => void;
  onOpenDocument: (id: string) => void;
  onOpenCalendar: () => void;
}

const dateLabel = (timestamp: number) => new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", month: "long", day: "numeric",
}).format(timestamp);

export function HomePage({ project, documents, onNewDocument, onOpenDocument, onOpenCalendar }: HomePageProps) {
  const recent = [...documents].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  const totalCharacters = documents.reduce((sum, document) => sum + countCharacters(document.content), 0);
  const completed = documents.filter((document) => document.status === "done").length;
  const today = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "long",
  }).format(new Date());

  return (
    <section className="home-page">
      <header className="home-heading">
        <p>{today}</p>
        <h1>{ko.home.headlineFirst}<br />{ko.home.headlineSecond}</h1>
        <span>{ko.home.introduction}</span>
      </header>

      <div className="home-actions" aria-label="빠른 작업">
        <button type="button" className="home-primary-action" onClick={onNewDocument}>
          <span><FilePlus2 /></span><div><strong>{ko.home.newDocument}</strong><small>{ko.home.newDocumentDescription}</small></div><ArrowRight />
        </button>
        <button type="button" onClick={() => recent[0] && onOpenDocument(recent[0].id)} disabled={recent.length === 0}>
          <span><PenLine /></span><div><strong>{ko.home.continueWriting}</strong><small>{recent[0]?.title ?? ko.home.noRecentDocument}</small></div><ArrowRight />
        </button>
        <button type="button" onClick={onOpenCalendar}>
          <span><CalendarDays /></span><div><strong>{ko.home.openCalendar}</strong><small>{ko.home.openCalendarDescription}</small></div><ArrowRight />
        </button>
      </div>

      <div className="home-overview">
        <section className="home-recent">
          <header><div><span>{ko.home.recent}</span><h2>{ko.home.recentDocuments}</h2></div><BookOpen /></header>
          <div className="home-recent-list">
            {recent.map((document) => (
              <button type="button" key={document.id} onClick={() => onOpenDocument(document.id)}>
                <div><strong>{document.title || ko.home.untitled}</strong><small>{document.folder} · {countCharacters(document.content).toLocaleString()}자</small></div>
                <time dateTime={new Date(document.updatedAt).toISOString()}>{dateLabel(document.updatedAt)}</time>
                <ArrowRight />
              </button>
            ))}
            {recent.length === 0 && <p>{ko.home.noDocuments}</p>}
          </div>
        </section>

        <aside className="home-project-summary">
          <span>{ko.home.currentProject}</span>
          <h2>{project.title}</h2>
          <p>{project.description}</p>
          <dl>
            <div><dt>{ko.home.documents}</dt><dd>{documents.length}<small>개</small></dd></div>
            <div><dt>{ko.home.characters}</dt><dd>{totalCharacters.toLocaleString()}<small>자</small></dd></div>
            <div><dt>{ko.home.completed}</dt><dd>{completed}<small>개</small></dd></div>
          </dl>
          <button type="button" onClick={() => recent[0] && onOpenDocument(recent[0].id)} disabled={recent.length === 0}>{ko.home.openProject} <ArrowRight /></button>
        </aside>
      </div>
    </section>
  );
}
