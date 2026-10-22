import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArchiveRestore, BookOpen, Check, ChevronDown, Circle, Clock3, Download, FilePlus2,
  Folder, Focus, Hash, Menu, MoreHorizontal, PanelLeftClose, PanelRightClose, Search,
  Settings2, Sparkles, Trash2, Wifi, WifiOff, X,
} from "lucide-react";
import {
  countCharacters, createDocument, initialWorkspace, saveDocument, searchDocuments,
  type DocumentStatus, type Workspace, type WritingDocument,
} from "@osunnote/domain";
import { ko } from "./i18n";
import { readWorkspace, writeWorkspace } from "./storage";

const statusLabel: Record<DocumentStatus, string> = { idea: "아이디어", draft: "초고", review: "다듬는 중", done: "완료" };
const statusTone: Record<DocumentStatus, string> = { idea: "blue", draft: "amber", review: "violet", done: "green" };

const download = (filename: string, body: string, type = "text/plain") => {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
};

export function App() {
  const [workspace, setWorkspace] = useState<Workspace>(() => initialWorkspace());
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);
  const [saveState, setSaveState] = useState<"saving" | "saved" | "error">("saved");
  const [mobileMenu, setMobileMenu] = useState(false);
  const lastSnapshotAt = useRef(0);

  useEffect(() => {
    readWorkspace().then((stored) => { if (stored) setWorkspace(stored); setReady(true); }).catch(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      writeWorkspace(workspace).then(() => setSaveState("saved")).catch(() => setSaveState("error"));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [workspace, ready]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  const project = workspace.projects.find((item) => item.id === workspace.activeProjectId) ?? workspace.projects[0]!;
  const document = project.documents.find((item) => item.id === workspace.activeDocumentId) ?? project.documents[0]!;
  const liveDocuments = project.documents.filter((item) => !item.deletedAt);
  const filtered = useMemo(() => searchDocuments(liveDocuments, query), [liveDocuments, query]);
  const folders = [...new Set(filtered.map((item) => item.folder))];
  const characters = countCharacters(document.content);
  const progress = Math.min(100, Math.round((characters / Math.max(document.goal, 1)) * 100));

  const selectDocument = (id: string) => {
    setWorkspace((current) => ({ ...current, activeDocumentId: id }));
    setMobileMenu(false);
  };

  const updateDocument = (patch: Partial<WritingDocument>, snapshot = false) => {
    setWorkspace((current) => saveDocument(current, document.id, patch, snapshot));
  };

  const updateBody = (content: string) => {
    const shouldSnapshot = Date.now() - lastSnapshotAt.current > 30_000;
    if (shouldSnapshot) lastSnapshotAt.current = Date.now();
    updateDocument({ content }, shouldSnapshot);
  };

  const addDocument = () => {
    const created = createDocument("제목 없는 글", "원고");
    setWorkspace((current) => ({
      ...current, revision: current.revision + 1, activeDocumentId: created.id,
      projects: current.projects.map((item) => item.id === project.id ? { ...item, documents: [...item.documents, created] } : item),
    }));
    setMobileMenu(false);
  };

  const moveToTrash = () => {
    const next = liveDocuments.find((item) => item.id !== document.id);
    if (!next) return;
    setWorkspace((current) => ({
      ...saveDocument(current, document.id, { deletedAt: Date.now() } as Partial<WritingDocument>),
      activeDocumentId: next.id,
    }));
  };

  const restoreVersion = (content: string) => updateDocument({ content }, true);

  if (!ready) return <div className="loading"><span className="brand-mark">O</span><p>작업실을 여는 중…</p></div>;

  return (
    <div className={`app ${focus ? "is-focus" : ""}`}>
      <header className="topbar">
        <button className="icon-button mobile-only" aria-label="메뉴 열기" onClick={() => setMobileMenu(true)}><Menu /></button>
        <div className="brand"><span className="brand-mark">O</span><span>{ko.appName}</span></div>
        <button className="project-switcher" aria-label="프로젝트 바꾸기">
          <span>{project.title}</span><ChevronDown size={15} />
        </button>
        <div className="topbar-actions">
          <div className={`save-state ${saveState}`}>
            {saveState === "saving" ? <Circle size={9} /> : <Check size={13} />}
            <span>{saveState === "saving" ? "저장 중" : saveState === "error" ? "저장 실패" : ko.saved}</span>
          </div>
          <button className="icon-button" aria-label={online ? "온라인" : ko.offline} title={online ? "온라인" : ko.offline}>
            {online ? <Wifi size={17} /> : <WifiOff size={17} />}
          </button>
          <button className="text-button" onClick={() => setFocus((value) => !value)}><Focus size={17} />{focus ? "나가기" : ko.focus}</button>
          <button className="avatar" aria-label="계정 메뉴">윤</button>
        </div>
      </header>

      <aside className={`sidebar left ${leftOpen ? "" : "collapsed"} ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="sidebar-mobile-head"><div className="brand"><span className="brand-mark">O</span>{ko.appName}</div><button className="icon-button" onClick={() => setMobileMenu(false)}><X /></button></div>
        <div className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ko.search} aria-label={ko.search} /><kbd>⌘K</kbd></div>
        <button className="new-button" onClick={addDocument}><FilePlus2 size={17} />{ko.newDocument}<span>⌘N</span></button>
        <nav className="navigation" aria-label="문서 탐색">
          <button className="nav-item active"><BookOpen size={17} />{ko.allDocuments}<span>{liveDocuments.length}</span></button>
          <button className="nav-item"><Clock3 size={17} />최근 작업</button>
          <button className="nav-item"><Hash size={17} />태그</button>
        </nav>
        <div className="tree-label"><span>프로젝트</span><button aria-label="프로젝트 옵션"><MoreHorizontal size={16} /></button></div>
        <div className="document-tree">
          {folders.map((folder) => (
            <section key={folder}>
              <div className="folder-row"><Folder size={16} /><span>{folder}</span><span>{filtered.filter((item) => item.folder === folder).length}</span></div>
              {filtered.filter((item) => item.folder === folder).map((item) => (
                <button key={item.id} className={`document-row ${item.id === document.id ? "selected" : ""}`} onClick={() => selectDocument(item.id)}>
                  <span className={`status-dot ${statusTone[item.status]}`} />
                  <span><strong>{item.title}</strong><small>{countCharacters(item.content).toLocaleString()}자 · {statusLabel[item.status]}</small></span>
                </button>
              ))}
            </section>
          ))}
          {filtered.length === 0 && <p className="empty-search">검색 결과가 없습니다.</p>}
        </div>
        <div className="sidebar-footer">
          <button className="nav-item"><Trash2 size={17} />{ko.trash}<span>{project.documents.filter((item) => item.deletedAt).length}</span></button>
          <button className="nav-item"><Settings2 size={17} />설정</button>
        </div>
        <button className="collapse-handle" onClick={() => setLeftOpen(false)} aria-label="왼쪽 패널 닫기"><PanelLeftClose size={16} /></button>
      </aside>
      {mobileMenu && <button className="scrim" aria-label="메뉴 닫기" onClick={() => setMobileMenu(false)} />}
      {!leftOpen && !focus && <button className="edge-open left-open" onClick={() => setLeftOpen(true)} aria-label="왼쪽 패널 열기"><Menu size={18} /></button>}

      <main className="editor-shell">
        <div className="document-header">
          <div className="breadcrumb"><span>{project.title}</span><span>/</span><span>{document.folder}</span></div>
          <div className="document-tools">
            <button className="icon-button" aria-label="Markdown으로 내보내기" onClick={() => download(`${document.title}.md`, document.content, "text/markdown")}><Download size={17} /></button>
            <button className="icon-button danger" aria-label="휴지통으로 이동" onClick={moveToTrash}><Trash2 size={16} /></button>
            <button className="icon-button desktop-only" aria-label="오른쪽 패널 닫기" onClick={() => setRightOpen((value) => !value)}><PanelRightClose size={17} /></button>
          </div>
        </div>
        <article className="editor">
          <input className="title-input" value={document.title} onChange={(event) => updateDocument({ title: event.target.value })} aria-label="글 제목" />
          <div className="meta-line"><span className={`status-pill ${statusTone[document.status]}`}>{statusLabel[document.status]}</span><span>{new Date(document.updatedAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} 수정</span></div>
          <textarea value={document.content} onChange={(event) => updateBody(event.target.value)} spellCheck aria-label="본문 편집기" placeholder="이야기를 시작해 보세요…" />
        </article>
        <footer className="editor-footer"><span>{characters.toLocaleString()}자</span><span>약 {Math.max(1, Math.ceil(characters / 600))}분 읽기</span><span>Markdown</span></footer>
      </main>

      <aside className={`sidebar right ${rightOpen ? "" : "collapsed"}`}>
        <div className="inspector-title"><span>{ko.details}</span><button className="icon-button" onClick={() => setRightOpen(false)}><X size={16} /></button></div>
        <section className="inspector-section goal-card">
          <div className="section-head"><span>오늘의 목표</span><strong>{progress}%</strong></div>
          <div className="progress"><i style={{ width: `${progress}%` }} /></div>
          <p><strong>{characters.toLocaleString()}</strong> / <input type="number" min="1" value={document.goal} onChange={(event) => updateDocument({ goal: Number(event.target.value) })} aria-label="목표 글자 수" />자</p>
        </section>
        <section className="inspector-section">
          <label>상태</label>
          <select value={document.status} onChange={(event) => updateDocument({ status: event.target.value as DocumentStatus })}>
            {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <label>태그</label>
          <div className="tags">{document.tags.map((tag) => <button key={tag} onClick={() => updateDocument({ tags: document.tags.filter((item) => item !== tag) })}>#{tag}<X size={11} /></button>)}<button className="add-tag" onClick={() => { const tag = window.prompt("새 태그 이름"); if (tag?.trim()) updateDocument({ tags: [...new Set([...document.tags, tag.trim()])] }); }}>+ 추가</button></div>
        </section>
        <section className="inspector-section version-section">
          <div className="section-head"><span>{ko.versions}</span><small>최근 {document.versions.length}개</small></div>
          {document.versions.length === 0 ? <p className="muted">글을 수정하면 이전 내용이 여기에 안전하게 남습니다.</p> : document.versions.slice(0, 5).map((version) => (
            <button className="version-row" key={version.id} onClick={() => restoreVersion(version.content)}>
              <ArchiveRestore size={15} /><span>{new Date(version.savedAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span><small>{countCharacters(version.content)}자</small>
            </button>
          ))}
        </section>
        <section className="inspector-section export-card">
          <Sparkles size={19} /><div><strong>내 글은 내 것으로</strong><p>언제든 표준 형식으로 보관하세요.</p></div>
          <button onClick={() => download(`${document.title}.txt`, document.content)}>{ko.export}</button>
        </section>
      </aside>
      {!rightOpen && !focus && <button className="edge-open right-open" onClick={() => setRightOpen(true)} aria-label="오른쪽 패널 열기"><Settings2 size={18} /></button>}
    </div>
  );
}
