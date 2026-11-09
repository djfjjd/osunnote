import { FilePlus2, FileText } from "lucide-react";
import { countCharacters, type WritingDocument } from "@osunnote/domain";
import { ko } from "./i18n";

interface DocumentListPageProps {
  documents: WritingDocument[];
  onOpenDocument: (id: string) => void;
  onNewDocument: () => void;
}

const createdDate = (timestamp: number) => new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
}).format(timestamp);

const previewText = (content: string) => content
  .replace(/^#{1,6}\s+/gm, "")
  .replace(/\s+/g, " ")
  .trim();

export function DocumentListPage({ documents, onOpenDocument, onNewDocument }: DocumentListPageProps) {
  const sorted = [...documents].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <section className="document-list-page">
      <header>
        <div><h1>{ko.documentList.title}</h1></div>
        <button type="button" onClick={onNewDocument}><FilePlus2 />{ko.newDocument}</button>
      </header>
      <div className="document-list">
        {sorted.map((document) => (
          <button type="button" key={document.id} onClick={() => onOpenDocument(document.id)}>
            <FileText className="document-list-icon" />
            <strong>{document.title || ko.home.untitled}</strong>
            <span className="document-list-preview">{previewText(document.content) || ko.documentList.emptyBody}</span>
            <small>{document.folder} · {countCharacters(document.content).toLocaleString()}자</small>
            <time dateTime={new Date(document.createdAt).toISOString()}>{ko.documentList.created} {createdDate(document.createdAt)}</time>
          </button>
        ))}
        {sorted.length === 0 && <p className="document-list-empty">{ko.home.noDocuments}</p>}
      </div>
    </section>
  );
}
