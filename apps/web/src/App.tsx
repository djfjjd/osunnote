import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArchiveRestore, BookOpen, Check, ChevronDown, Circle, Clock3, Download, FilePlus2,
  Folder, Focus, Hash, HelpCircle, Keyboard, Menu, MoreHorizontal, PanelLeftClose,
  PanelRightClose, PencilLine, RotateCcw, Search, Settings2, ShieldCheck, Sparkles,
  Trash2, Wifi, WifiOff, X,
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
  const [view, setView] = useState<"documents" | "trash">("documents");
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() =>
    new URLSearchParams(window.location.search).has("welcome") || localStorage.getItem("osunnote-welcome-seen") !== "yes",
  );
  const lastSnapshotAt = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    readWorkspace().then((stored) => { if (stored) setWorkspace(stored); setReady(true); }).catch(() => setReady(true));
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setLeftOpen(true);
        setMobileMenu(true);
        window.setTimeout(() => searchRef.current?.focus(), 0);
      }
      if (event.key.toLocaleLowerCase() === "n") {
        event.preventDefault();
        addDocument();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

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
  const deletedDocuments = project.documents.filter((item) => item.deletedAt);
  const filtered = useMemo(() => searchDocuments(liveDocuments, query), [liveDocuments, query]);
  const folders = [...new Set(filtered.map((item) => item.folder))];
  const characters = countCharacters(document.content);
  const progress = Math.min(100, Math.round((characters / Math.max(document.goal, 1)) * 100));

  const selectDocument = (id: string) => {
    setWorkspace((current) => ({ ...current, activeDocumentId: id }));
    setView("documents");
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
    setView("documents");
    setMobileMenu(false);
  };

  const moveToTrash = (documentId = document.id) => {
    const next = liveDocuments.find((item) => item.id !== documentId);
    if (!next) return;
    setWorkspace((current) => {
      const updated = saveDocument(current, documentId, { deletedAt: Date.now() } as Partial<WritingDocument>);
      return documentId === current.activeDocumentId ? { ...updated, activeDocumentId: next.id } : updated;
    });
  };

  const restoreVersion = (content: string) => updateDocument({ content }, true);

  const restoreDocument = (documentId: string) => {
    setWorkspace((current) => saveDocument(current, documentId, { deletedAt: undefined } as Partial<WritingDocument>));
  };

  const deleteForever = (documentId: string) => {
    const target = deletedDocuments.find((item) => item.id === documentId);
    if (!target || !window.confirm(`‘${target.title}’ 글을 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    setWorkspace((current) => ({
      ...current,
      revision: current.revision + 1,
      projects: current.projects.map((item) => item.id === project.id
        ? { ...item, documents: item.documents.filter((entry) => entry.id !== documentId) }
        : item),
    }));
  };

  const emptyTrash = () => {
    if (deletedDocuments.length === 0 || !window.confirm(`휴지통의 글 ${deletedDocuments.length}개를 모두 영구 삭제할까요?`)) return;
    setWorkspace((current) => ({
      ...current,
      revision: current.revision + 1,
      projects: current.projects.map((item) => item.id === project.id
        ? { ...item, documents: item.documents.filter((entry) => !entry.deletedAt) }
        : item),
    }));
  };

  const renameProject = () => {
    const title = window.prompt("프로젝트 이름", project.title)?.trim();
    if (!title || title === project.title) return;
    setWorkspace((current) => ({
      ...current,
      revision: current.revision + 1,
      projects: current.projects.map((item) => item.id === project.id ? { ...item, title } : item),
    }));
    setProjectMenuOpen(false);
  };

  const closeWelcome = (focusEditor = false) => {
    localStorage.setItem("osunnote-welcome-seen", "yes");
    setShowWelcome(false);
    if (focusEditor) window.setTimeout(() => editorRef.current?.focus(), 0);
  };

  if (!ready) return <div className="loading"><span className="brand-mark">O</span><p>작업실을 여는 중…</p></div>;

  return (
    <div className={`app ${focus ? "is-focus" : ""}`}>
      <header className="topbar">
        <button className="icon-button mobile-only" aria-label="메뉴 열기" onClick={() => setMobileMenu(true)}><Menu /></button>
        <div className="brand"><span className="brand-mark">O</span><span>{ko.appName}</span></div>
        <button className={`project-switcher ${projectMenuOpen ? "open" : ""}`} aria-label="프로젝트 메뉴 열기" aria-expanded={projectMenuOpen} onClick={() => setProjectMenuOpen((value) => !value)}>
          <span>{project.title}</span><ChevronDown size={15} />
        </button>
        {projectMenuOpen && (
          <div className="project-menu">
            <span className="project-menu-label">현재 프로젝트</span>
            <strong>{project.title}</strong>
            <p>{project.description}</p>
            <div><span>{liveDocuments.length}개 글</span><span>{liveDocuments.reduce((sum, item) => sum + countCharacters(item.content), 0).toLocaleString()}자</span></div>
            <button onClick={renameProject}><PencilLine size={14} />프로젝트 이름 바꾸기</button>
          </div>
        )}
        <div className="topbar-actions">
          <div className={`save-state ${saveState}`}>
            {saveState === "saving" ? <Circle size={9} /> : <Check size={13} />}
            <span>{saveState === "saving" ? "저장 중" : saveState === "error" ? "저장 실패" : ko.saved}</span>
          </div>
          <button className="icon-button" aria-label={online ? "온라인" : ko.offline} title={online ? "온라인" : ko.offline}>
            {online ? <Wifi size={17} /> : <WifiOff size={17} />}
          </button>
          <button className="text-button help-button" onClick={() => setShowWelcome(true)}><HelpCircle size={17} />도움말</button>
          <button className="text-button" onClick={() => setFocus((value) => !value)}><Focus size={17} />{focus ? "나가기" : ko.focus}</button>
          <button className="avatar" aria-label="계정 메뉴">윤</button>
        </div>
      </header>

      <aside className={`sidebar left ${leftOpen ? "" : "collapsed"} ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="sidebar-mobile-head"><div className="brand"><span className="brand-mark">O</span>{ko.appName}</div><button className="icon-button" onClick={() => setMobileMenu(false)}><X /></button></div>
        <div className="search-box"><Search size={16} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ko.search} aria-label={ko.search} /><kbd>⌘K</kbd></div>
        <button className="new-button" onClick={addDocument}><FilePlus2 size={17} />{ko.newDocument}<span>⌘N</span></button>
        <nav className="navigation" aria-label="문서 탐색">
          <button className={`nav-item ${view === "documents" ? "active" : ""}`} onClick={() => setView("documents")}><BookOpen size={17} />{ko.allDocuments}<span>{liveDocuments.length}</span></button>
          <button className="nav-item"><Clock3 size={17} />최근 작업</button>
          <button className="nav-item"><Hash size={17} />태그</button>
        </nav>
        <div className="tree-label"><span>프로젝트</span><button aria-label="프로젝트 옵션"><MoreHorizontal size={16} /></button></div>
        <div className="document-tree">
          {folders.map((folder) => (
            <section key={folder}>
              <div className="folder-row"><Folder size={16} /><span>{folder}</span><span>{filtered.filter((item) => item.folder === folder).length}</span></div>
              {filtered.filter((item) => item.folder === folder).map((item) => (
                <div key={item.id} className={`document-row ${item.id === document.id ? "selected" : ""}`}>
                  <button className="document-select" onClick={() => selectDocument(item.id)} aria-label={`${item.title} 열기`}>
                    <span className={`status-dot ${statusTone[item.status]}`} />
                    <span className="document-copy"><strong>{item.title}</strong><small>{countCharacters(item.content).toLocaleString()}자 · {statusLabel[item.status]}</small></span>
                  </button>
                  <button
                    className="document-delete"
                    onClick={() => moveToTrash(item.id)}
                    disabled={liveDocuments.length <= 1}
                    aria-label={`${item.title} 휴지통으로 이동`}
                    title={liveDocuments.length <= 1 ? "마지막 글은 삭제할 수 없습니다" : "휴지통으로 이동"}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </section>
          ))}
          {filtered.length === 0 && <p className="empty-search">검색 결과가 없습니다.</p>}
        </div>
        <div className="sidebar-footer">
          <button className={`nav-item ${view === "trash" ? "active" : ""}`} onClick={() => { setView("trash"); setMobileMenu(false); }}><Trash2 size={17} />{ko.trash}<span>{deletedDocuments.length}</span></button>
          <button className="nav-item"><Settings2 size={17} />설정</button>
        </div>
        <button className="collapse-handle" onClick={() => setLeftOpen(false)} aria-label="왼쪽 패널 닫기"><PanelLeftClose size={16} /></button>
      </aside>
      {mobileMenu && <button className="scrim" aria-label="메뉴 닫기" onClick={() => setMobileMenu(false)} />}
      {!leftOpen && !focus && <button className="edge-open left-open" onClick={() => setLeftOpen(true)} aria-label="왼쪽 패널 열기"><Menu size={18} /></button>}

      <main className={`editor-shell ${view === "trash" ? "trash-view" : ""}`}>
        {view === "trash" ? (
          <section className="trash-page">
            <header>
              <div><span className="trash-eyebrow">보관함</span><h1>휴지통</h1><p>삭제한 글은 이 기기에 남아 있으며 언제든 복원할 수 있습니다.</p></div>
              <button className="empty-trash-button" onClick={emptyTrash} disabled={deletedDocuments.length === 0}><Trash2 size={16} />휴지통 비우기</button>
            </header>
            {deletedDocuments.length === 0 ? (
              <div className="trash-empty"><span><Trash2 size={24} /></span><strong>휴지통이 비어 있습니다</strong><p>삭제한 글이 이곳에 표시됩니다.</p><button onClick={() => setView("documents")}>모든 글로 돌아가기</button></div>
            ) : (
              <div className="trash-list">
                {deletedDocuments.map((item) => (
                  <article key={item.id}>
                    <div><strong>{item.title}</strong><p>{item.folder} · {countCharacters(item.content).toLocaleString()}자 · {new Date(item.deletedAt!).toLocaleDateString("ko-KR")} 삭제</p></div>
                    <div className="trash-actions">
                      <button className="restore-button" onClick={() => restoreDocument(item.id)}><RotateCcw size={15} />복원</button>
                      <button className="delete-forever-button" onClick={() => deleteForever(item.id)}><Trash2 size={15} />영구 삭제</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : (<>
        <div className="document-header">
          <div className="breadcrumb"><span>{project.title}</span><span>/</span><span>{document.folder}</span></div>
          <div className="document-tools">
            <button className="tool-button" aria-label="Markdown으로 내보내기" onClick={() => download(`${document.title}.md`, document.content, "text/markdown")}><Download size={16} /><span>저장</span></button>
            <button className="tool-button danger" aria-label="휴지통으로 이동" onClick={() => moveToTrash()} disabled={liveDocuments.length <= 1}><Trash2 size={15} /><span>삭제</span></button>
            <button className="icon-button desktop-only" aria-label="오른쪽 패널 닫기" onClick={() => setRightOpen((value) => !value)}><PanelRightClose size={17} /></button>
          </div>
        </div>
        <article className="editor">
          <input className="title-input" value={document.title} onChange={(event) => updateDocument({ title: event.target.value })} aria-label="글 제목" />
          <div className="meta-line"><span className={`status-pill ${statusTone[document.status]}`}>{statusLabel[document.status]}</span><span>{new Date(document.updatedAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} 수정</span></div>
          <textarea ref={editorRef} value={document.content} onChange={(event) => updateBody(event.target.value)} spellCheck aria-label="본문 편집기" placeholder="여기를 눌러 이야기를 시작하세요. Markdown 문법도 사용할 수 있어요." />
        </article>
        <footer className="editor-footer"><span>{characters.toLocaleString()}자</span><span>약 {Math.max(1, Math.ceil(characters / 600))}분 읽기</span><span>Markdown</span></footer>
        </>)}
      </main>

      <aside className={`sidebar right ${rightOpen && view === "documents" ? "" : "collapsed"}`}>
        <div className="inspector-title"><span>{ko.details}</span><button className="icon-button" aria-label="글 정보 닫기" onClick={() => setRightOpen(false)}><X size={16} /></button></div>
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
      {!rightOpen && !focus && view === "documents" && <button className="edge-open right-open" onClick={() => setRightOpen(true)} aria-label="오른쪽 패널 열기"><Settings2 size={18} /></button>}

      {showWelcome && (
        <div className="welcome-backdrop" role="presentation">
          <section className="welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
            <button className="welcome-close" aria-label="시작 안내 닫기" onClick={() => closeWelcome()}><X size={18} /></button>
            <div className="welcome-eyebrow"><span className="brand-mark">O</span><span>OSUNNOTE 시작 가이드</span></div>
            <h1 id="welcome-title">복잡한 설정 없이,<br />바로 쓰기 시작하세요.</h1>
            <p className="welcome-lead">글은 이 기기에 자동으로 저장됩니다. 처음에는 아래 세 가지만 기억하면 충분해요.</p>
            <div className="welcome-steps">
              <article><span><PencilLine size={19} /></span><div><strong>1. 제목과 본문 쓰기</strong><p>가운데 편집 영역을 누르고 자유롭게 작성하세요.</p></div></article>
              <article><span><ShieldCheck size={19} /></span><div><strong>2. 자동 저장 확인</strong><p>상단의 ‘이 기기에 저장됨’ 표시가 글을 지켜줍니다.</p></div></article>
              <article><span><Keyboard size={19} /></span><div><strong>3. 빠르게 찾고 추가하기</strong><p><kbd>⌘K</kbd>로 검색하고 <kbd>⌘N</kbd>으로 새 글을 만드세요.</p></div></article>
            </div>
            <div className="welcome-actions">
              <button className="welcome-secondary" onClick={() => { addDocument(); closeWelcome(true); }}><FilePlus2 size={17} />새 글부터 만들기</button>
              <button className="welcome-primary" onClick={() => closeWelcome(true)}>현재 글에서 시작하기 <span>→</span></button>
            </div>
            <small>도움말 버튼에서 언제든 이 안내를 다시 볼 수 있어요.</small>
          </section>
        </div>
      )}
    </div>
  );
}
