import { FilePlus2, FileText, PencilLine } from "lucide-react";
import { countCharacters, type WritingDocument } from "@osunnote/domain";
import { ko } from "./i18n";

interface DocumentListPageProps {
  projectName: string;
  documents: WritingDocument[];
  folder?: string;
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

export function DocumentListPage({ projectName, documents, folder, onOpenDocument, onNewDocument }: DocumentListPageProps) {
  const sorted = documents.filter((document) => !folder || document.folder === folder || document.folder.startsWith(`${folder}/`)).sort((a, b) => b.updatedAt - a.updatedAt);

  return (<>
    <div className="document-header library-document-header"><div className="breadcrumb"><span>{projectName}</span><span>/</span><strong className="breadcrumb-current-title">{folder ?? "글 목록"}</strong></div></div>
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
        {sorted.length === 0 && (
          <div className="document-list-empty-state">
            <span><PencilLine size={25} /></span>
            <h2>아직 작성한 글이 없습니다</h2>
            <p>새 글을 만들고 이야기를 시작해 보세요.</p>
            <button type="button" onClick={onNewDocument}><FilePlus2 size={17} />+ 새 글 작성하기</button>
          </div>
        )}
      </div>
    </section>
  </>
  );
}
