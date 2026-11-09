import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArchiveRestore, BookOpen, CalendarDays, Check, ChevronDown, Circle, Clock3, Download, FilePlus2,
  Folder, FolderPlus, Focus, Hash, HelpCircle, House, Keyboard, Menu, MoreHorizontal, PanelLeftClose,
  PanelRightClose, PencilLine, RotateCcw, Search, Settings2, ShieldCheck, Sparkles,
  Trash2, Wifi, WifiOff, X,
} from "lucide-react";
import {
  countCharacters, createDocument, initialWorkspace, saveDocument, searchDocuments,
  type DocumentStatus, type Workspace, type WritingDocument,
} from "@osunnote/domain";
import { ko } from "./i18n";
import { readWorkspace, writeWorkspace } from "./storage";
import { CalendarPage } from "./CalendarPage";
import { TopbarCalendar } from "./TopbarCalendar";
import { HomePage } from "./HomePage";
import { DocumentListPage } from "./DocumentListPage";

const statusLabel: Record<DocumentStatus, string> = { idea: "아이디어", draft: "초고", review: "다듬는 중", done: "완료" };
const statusTone: Record<DocumentStatus, string> = { idea: "blue", draft: "amber", review: "violet", done: "green" };

const download = (filename: string, body: string, type = "text/plain") => {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
};

const folderHierarchy = (paths: string[]): string[] => {
  const expanded = new Set<string>();
  paths.forEach((path) => {
    const parts = path.split("/").map((part) => part.trim()).filter(Boolean);
    parts.forEach((_, index) => expanded.add(parts.slice(0, index + 1).join("/")));
  });
  return [...expanded].sort((a, b) => a.localeCompare(b, "ko-KR"));
};

const shouldShowWelcome = (): boolean => {
  if (new URLSearchParams(window.location.search).has("welcome")) return true;
  try {
    return localStorage.getItem("osunnote-welcome-seen") !== "yes";
  } catch {
    return true;
  }
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
  const [storageError, setStorageError] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [view, setView] = useState<"home" | "library" | "documents" | "calendar" | "trash">("home");
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectManagerOpen, setProjectManagerOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string>();
  const [projectTitleDraft, setProjectTitleDraft] = useState("");
  const [projectDescriptionDraft, setProjectDescriptionDraft] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("원고");
  const [dragOverFolder, setDragOverFolder] = useState<string>();
  const [showWelcome, setShowWelcome] = useState(shouldShowWelcome);
  const lastSnapshotAt = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const projectManagerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  useEffect(() => {
    readWorkspace()
      .then((stored) => { if (stored) setWorkspace(stored); })
      .catch(() => setStorageError(true))
      .finally(() => setReady(true));
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
      if (event.key.toLocaleLowerCase() === "n" && event.altKey) {
        event.preventDefault();
        addDocument();
      }
      if (event.key.toLocaleLowerCase() === "s") {
        event.preventDefault();
        void completeAndSaveDocument();
      }
      if (event.key === "Enter") {
        event.preventDefault();
        setFocus((value) => !value);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

  useEffect(() => {
    if (!ready || storageError) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      writeWorkspace(workspace).then(() => setSaveState("saved")).catch(() => setSaveState("error"));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [workspace, ready, storageError]);

  useEffect(() => {
    if (!ready || storageError) return;
    const saveLatest = () => {
      if (globalThis.document.visibilityState === "hidden") {
        void writeWorkspace(workspaceRef.current).catch(() => setSaveState("error"));
      }
    };
    globalThis.document.addEventListener("visibilitychange", saveLatest);
    return () => globalThis.document.removeEventListener("visibilitychange", saveLatest);
  }, [ready, storageError]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  useEffect(() => {
    if (!projectMenuOpen && !projectManagerOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!projectMenuRef.current?.contains(target) && !projectManagerRef.current?.contains(target)) {
        setProjectMenuOpen(false);
        setProjectManagerOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProjectMenuOpen(false);
        setProjectManagerOpen(false);
      }
    };
    globalThis.document.addEventListener("pointerdown", closeOnOutside);
    globalThis.document.addEventListener("keydown", closeOnEscape);
    return () => {
      globalThis.document.removeEventListener("pointerdown", closeOnOutside);
      globalThis.document.removeEventListener("keydown", closeOnEscape);
    };
  }, [projectManagerOpen, projectMenuOpen]);

  useEffect(() => {
    if (!editingProjectId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditingProjectId(undefined);
    };
    globalThis.document.addEventListener("keydown", closeOnEscape);
    return () => globalThis.document.removeEventListener("keydown", closeOnEscape);
  }, [editingProjectId]);

  const project = workspace.projects.find((item) => item.id === workspace.activeProjectId) ?? workspace.projects[0]!;
  const liveDocuments = project.documents.filter((item) => !item.deletedAt);
  const document = liveDocuments.find((item) => item.id === workspace.activeDocumentId) ?? liveDocuments[0];
  const deletedDocuments = project.documents.filter((item) => item.deletedAt);
  const filtered = useMemo(() => searchDocuments(liveDocuments, query), [liveDocuments, query]);
  const folders = folderHierarchy([...(project.folders ?? []), ...filtered.map((item) => item.folder)]);
  const selectedFolderPath = folders.includes(selectedFolder) ? selectedFolder : document?.folder ?? folders[0] ?? "원고";
  const characters = countCharacters(document?.content ?? "");
  const progress = document ? Math.min(100, Math.round((characters / Math.max(document.goal, 1)) * 100)) : 0;

  const selectDocument = (id: string) => {
    const selected = liveDocuments.find((item) => item.id === id);
    if (selected) setSelectedFolder(selected.folder);
    setWorkspace((current) => ({ ...current, activeDocumentId: id }));
    setView("documents");
    setMobileMenu(false);
  };

  const updateDocument = (patch: Partial<WritingDocument>, snapshot = false) => {
    if (!document) return;
    setWorkspace((current) => saveDocument(current, document.id, patch, snapshot));
  };

  async function completeAndSaveDocument() {
    const current = workspaceRef.current;
    const currentProject = current.projects.find((item) => item.id === current.activeProjectId);
    const activeDocument = currentProject?.documents.find((item) => item.id === current.activeDocumentId && !item.deletedAt)
      ?? currentProject?.documents.find((item) => !item.deletedAt);
    if (!activeDocument) return;
    const next = saveDocument(current, activeDocument.id, { status: "done" }, true);
    workspaceRef.current = next;
    setWorkspace(next);
    setSaveState("saving");
    try {
      await writeWorkspace(next);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  const updateBody = (content: string) => {
    const shouldSnapshot = Date.now() - lastSnapshotAt.current > 30_000;
    if (shouldSnapshot) lastSnapshotAt.current = Date.now();
    updateDocument({ content }, shouldSnapshot);
  };

  const addDocument = () => {
    const created = createDocument("제목 없는 글", selectedFolderPath);
    setWorkspace((current) => ({
      ...current, revision: current.revision + 1, activeDocumentId: created.id,
      projects: current.projects.map((item) => item.id === project.id ? { ...item, documents: [...item.documents, created] } : item),
    }));
    setView("documents");
    setMobileMenu(false);
  };

  const moveToTrash = (documentId = document?.id) => {
    if (!documentId) return;
    const next = liveDocuments.find((item) => item.id !== documentId);
    setWorkspace((current) => {
      const updated = saveDocument(current, documentId, { deletedAt: Date.now() } as Partial<WritingDocument>);
      return documentId === current.activeDocumentId && next ? { ...updated, activeDocumentId: next.id } : updated;
    });
  };

  const restoreVersion = (content: string) => updateDocument({ content }, true);

  const restoreDocument = (documentId: string) => {
    setWorkspace((current) => saveDocument(current, documentId, { deletedAt: undefined } as Partial<WritingDocument>));
  };

  const moveDocumentToFolder = (documentId: string, folder: string) => {
    setWorkspace((current) => saveDocument(current, documentId, { folder }));
    setSelectedFolder(folder);
    setDragOverFolder(undefined);
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

  const editProject = (projectId = project.id) => {
    const target = workspace.projects.find((item) => item.id === projectId);
    if (!target) return;
    setEditingProjectId(target.id);
    setProjectTitleDraft(target.title);
    setProjectDescriptionDraft(target.description);
    setProjectMenuOpen(false);
    setProjectManagerOpen(false);
  };

  const saveProjectEdit = () => {
    if (!editingProjectId) return;
    const title = projectTitleDraft.trim();
    if (!title) return;
    const description = projectDescriptionDraft.trim();
    setWorkspace((current) => ({
      ...current,
      revision: current.revision + 1,
      projects: current.projects.map((item) => item.id === editingProjectId ? { ...item, title, description } : item),
    }));
    setEditingProjectId(undefined);
  };

  const addProject = () => {
    const titleInput = window.prompt(ko.project.namePrompt);
    if (titleInput === null) return;
    const title = titleInput.trim();
    if (!title) return;
    const descriptionInput = window.prompt(ko.project.descriptionPrompt);
    if (descriptionInput === null) return;
    const description = descriptionInput.trim();
    const created = createDocument();
    const createdProject = {
      id: crypto.randomUUID(), title, description,
      folders: ["원고"],
      documents: [created], createdAt: Date.now(),
    };
    setWorkspace((current) => ({
      ...current,
      revision: current.revision + 1,
      activeProjectId: createdProject.id,
      activeDocumentId: created.id,
      projects: [...current.projects, createdProject],
    }));
    setView("documents");
    setProjectMenuOpen(false);
    setProjectManagerOpen(false);
    setMobileMenu(false);
  };

  const selectProject = (projectId: string) => {
    const selected = workspace.projects.find((item) => item.id === projectId);
    const firstDocument = selected?.documents.find((item) => !item.deletedAt) ?? selected?.documents[0];
    if (!selected) return;
    setWorkspace((current) => ({
      ...current, activeProjectId: selected.id, activeDocumentId: firstDocument?.id ?? "",
    }));
    setSelectedFolder(firstDocument?.folder ?? selected.folders[0] ?? "원고");
    setView("library");
    setProjectMenuOpen(false);
    setProjectManagerOpen(false);
    setMobileMenu(false);
  };

  const deleteProject = (projectId: string) => {
    if (workspace.projects.length <= 1) return;
    const target = workspace.projects.find((item) => item.id === projectId);
    const replacement = workspace.projects.find((item) => item.id !== projectId);
    if (!target || !replacement || !window.confirm(`‘${target.title}’ 프로젝트와 포함된 글을 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    const replacementDocument = replacement.documents.find((item) => !item.deletedAt) ?? replacement.documents[0];
    setWorkspace((current) => ({
      ...current,
      revision: current.revision + 1,
      activeProjectId: current.activeProjectId === projectId ? replacement.id : current.activeProjectId,
      activeDocumentId: current.activeProjectId === projectId ? replacementDocument?.id ?? "" : current.activeDocumentId,
      projects: current.projects.filter((item) => item.id !== projectId),
    }));
    if (projectId === workspace.activeProjectId) setView("home");
    setProjectMenuOpen(false);
    setProjectManagerOpen(false);
  };

  const addFolder = (parent = "", projectId = project.id) => {
    const input = window.prompt(parent ? `‘${parent}’ 안에 만들 하위 폴더 이름` : "새 폴더 이름");
    if (input === null) return;
    const childPath = input.split("/").map((part) => part.trim()).filter(Boolean).join("/");
    if (!childPath) return;
    const path = parent ? `${parent}/${childPath}` : childPath;
    setWorkspace((current) => ({
      ...current,
      revision: current.revision + 1,
      projects: current.projects.map((item) => item.id === projectId
        ? { ...item, folders: folderHierarchy([...(item.folders ?? []), path]) }
        : item),
    }));
    if (projectId === project.id) setSelectedFolder(path);
  };

  const renameFolder = (projectId: string, folder: string) => {
    const parent = folder.split("/").slice(0, -1).join("/");
    const currentName = folder.split("/").at(-1) ?? folder;
    const input = window.prompt("폴더 이름 변경", currentName);
    if (input === null) return;
    const name = input.trim().replaceAll("/", "");
    if (!name || name === currentName) return;
    const nextPath = parent ? `${parent}/${name}` : name;
    const replacePath = (path: string) => path === folder || path.startsWith(`${folder}/`) ? `${nextPath}${path.slice(folder.length)}` : path;
    setWorkspace((current) => ({
      ...current,
      revision: current.revision + 1,
      projects: current.projects.map((item) => item.id === projectId ? {
        ...item,
        folders: folderHierarchy(item.folders.map(replacePath)),
        documents: item.documents.map((entry) => ({ ...entry, folder: replacePath(entry.folder) })),
      } : item),
    }));
    if (projectId === project.id && (selectedFolder === folder || selectedFolder.startsWith(`${folder}/`))) setSelectedFolder(replacePath(selectedFolder));
  };

  const deleteFolder = (projectId: string, folder: string) => {
    const target = workspace.projects.find((item) => item.id === projectId);
    if (!target) return;
    const affected = target.documents.filter((entry) => entry.folder === folder || entry.folder.startsWith(`${folder}/`)).length;
    const message = affected > 0
      ? `‘${folder}’ 폴더를 삭제할까요? 포함된 글 ${affected}개는 ‘원고’ 폴더로 이동합니다.`
      : `‘${folder}’ 폴더를 삭제할까요?`;
    if (!window.confirm(message)) return;
    setWorkspace((current) => ({
      ...current,
      revision: current.revision + 1,
      projects: current.projects.map((item) => item.id === projectId ? {
        ...item,
        folders: folderHierarchy(["원고", ...item.folders.filter((path) => path !== folder && !path.startsWith(`${folder}/`))]),
        documents: item.documents.map((entry) => entry.folder === folder || entry.folder.startsWith(`${folder}/`) ? { ...entry, folder: "원고" } : entry),
      } : item),
    }));
    if (projectId === project.id && (selectedFolder === folder || selectedFolder.startsWith(`${folder}/`))) setSelectedFolder("원고");
  };

  const closeWelcome = (focusEditor = false) => {
    try {
      localStorage.setItem("osunnote-welcome-seen", "yes");
    } catch {
      // 저장소가 차단된 환경에서도 작업실은 계속 사용할 수 있어야 한다.
    }
    setShowWelcome(false);
    if (focusEditor) window.setTimeout(() => editorRef.current?.focus(), 0);
  };

  if (!ready) return <div className="loading"><span className="brand-mark">O</span><p>작업실을 여는 중…</p></div>;
  if (storageError) return (
    <main className="startup-error" role="alert">
      <span className="brand-mark">O</span>
      <h1>저장된 글을 안전하게 열지 못했습니다</h1>
      <p>기존 글을 덮어쓰지 않도록 편집을 중단했습니다. 다른 OSUNNOTE 탭을 닫은 뒤 다시 시도해 주세요.</p>
      <button type="button" onClick={() => window.location.reload()}>다시 시도</button>
    </main>
  );

  return (
    <div className={`app ${focus ? "is-focus" : ""}`}>
      <header className="topbar">
        <button className="icon-button mobile-only" aria-label="메뉴 열기" onClick={() => setMobileMenu(true)}><Menu /></button>
        <button type="button" className="brand brand-home" onClick={() => { setView("home"); setMobileMenu(false); }} aria-label="OSUNNOTE 홈으로 이동"><span className="brand-mark">O</span><span>{ko.appName}</span></button>
        <div className="project-switcher-wrap" ref={projectMenuRef}>
          <button className={`project-switcher ${projectMenuOpen ? "open" : ""}`} aria-label="프로젝트 메뉴 열기" aria-expanded={projectMenuOpen} onClick={() => { setProjectMenuOpen((value) => !value); setProjectManagerOpen(false); }}>
            <span>{project.title}</span><ChevronDown size={15} />
          </button>
          {projectMenuOpen && (
            <div className="project-menu">
              <span className="project-menu-label">{ko.project.current}</span>
              <div className="project-menu-title"><strong>{project.title}</strong><button type="button" onClick={() => editProject()} aria-label={ko.project.edit} title={ko.project.edit}><PencilLine size={14} /></button></div>
              <p>{project.description || ko.project.noDescription}</p>
              <div className="project-menu-stats"><span>{liveDocuments.length}개 글</span><span>{liveDocuments.reduce((sum, item) => sum + countCharacters(item.content), 0).toLocaleString()}자</span></div>
              <div className="project-menu-projects">
                <span>{ko.project.all}</span>
                <div>
                  {workspace.projects.map((item) => (
                    <div className={`project-menu-project-row ${item.id === project.id ? "active" : ""}`} key={item.id}>
                      <button type="button" className="project-menu-project-switch" onClick={() => selectProject(item.id)}>
                        <strong>{item.title}</strong><small>{item.documents.filter((entry) => !entry.deletedAt).length}개 글</small>
                      </button>
                      <button type="button" className="project-delete-button" onClick={() => deleteProject(item.id)} disabled={workspace.projects.length <= 1} aria-label={`${item.title} 프로젝트 삭제`} title={workspace.projects.length <= 1 ? "마지막 프로젝트는 삭제할 수 없습니다" : "프로젝트 삭제"}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
              <button className="project-add-button" onClick={addProject}><FilePlus2 size={14} />{ko.project.add}</button>
            </div>
          )}
        </div>
        <TopbarCalendar />
        <div className="topbar-actions">
          <div className={`save-state ${saveState}`}>
            {saveState === "saving" ? <Circle size={9} /> : <Check size={13} />}
            <span>{saveState === "saving" ? "저장 중" : saveState === "error" ? "저장 실패" : ko.saved}</span>
          </div>
          <button className="icon-button" aria-label={online ? "온라인" : ko.offline} title={online ? "온라인" : ko.offline}>
            {online ? <Wifi size={17} /> : <WifiOff size={17} />}
          </button>
          <button className="text-button help-button" onClick={() => setShowWelcome(true)}><HelpCircle size={17} />도움말</button>
          <button className="text-button focus-button" onClick={() => setFocus((value) => !value)} title="집중 모드 (⌘ Enter)" aria-keyshortcuts="Meta+Enter Control+Enter"><Focus size={17} />{focus ? "나가기" : ko.focus}<kbd>⌘ Enter</kbd></button>
          <button className="avatar" aria-label="계정 메뉴">윤</button>
        </div>
      </header>

      <aside className={`sidebar left ${leftOpen ? "" : "collapsed"} ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="sidebar-mobile-head"><button type="button" className="brand brand-home" onClick={() => { setView("home"); setMobileMenu(false); }} aria-label="OSUNNOTE 홈으로 이동"><span className="brand-mark">O</span>{ko.appName}</button><button className="icon-button" onClick={() => setMobileMenu(false)}><X /></button></div>
        <div className="search-box"><Search size={16} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ko.search} aria-label={ko.search} /><kbd>⌘K</kbd></div>
        <button className="home-button" onClick={() => { setView("home"); setMobileMenu(false); }}><House size={17} />{ko.home.nav}</button>
        <nav className="navigation" aria-label="문서 탐색">
          <button className="nav-item" onClick={addDocument} title="새 글 (⌘⌥N)" aria-keyshortcuts="Meta+Alt+N Control+Alt+N"><FilePlus2 size={17} />{ko.newDocument}<span className="shortcut-label">⌘⌥N</span></button>
          <button className={`nav-item ${view === "library" ? "active" : ""}`} onClick={() => setView("library")}><BookOpen size={17} />{ko.allDocuments}<span>{liveDocuments.length}</span></button>
          <button className={`nav-item ${view === "calendar" ? "active" : ""}`} onClick={() => { setView("calendar"); setMobileMenu(false); }}><CalendarDays size={17} />{ko.calendar}</button>
          <button className="nav-item"><Clock3 size={17} />최근 작업</button>
          <button className="nav-item"><Hash size={17} />태그</button>
        </nav>
        <div className="tree-label">
          <span>프로젝트</span>
          <div className="project-manager-wrap" ref={projectManagerRef}>
            <button type="button" aria-label="최상위 폴더 추가" title="폴더 추가" onClick={() => addFolder()}><FolderPlus size={15} /></button>
            <button type="button" aria-label="프로젝트 옵션" aria-expanded={projectManagerOpen} onClick={() => { setProjectManagerOpen((value) => !value); setProjectMenuOpen(false); }}><MoreHorizontal size={16} /></button>
            {projectManagerOpen && (
              <div className="project-manager-menu">
                <strong>{ko.project.manage}</strong>
                <div className="project-manager-list">
                  {workspace.projects.map((item) => (
                    <section className={`project-manager-project ${item.id === project.id ? "active" : ""}`} key={item.id}>
                      <div className="project-manager-project-row">
                        <button type="button" onClick={() => selectProject(item.id)}><span>{item.title}</span><small>{item.documents.filter((entry) => !entry.deletedAt).length}개 글</small></button>
                        <button type="button" className="project-manager-folder-add" onClick={() => addFolder("", item.id)} aria-label={`${item.title} 폴더 추가`} title="폴더 추가"><FolderPlus size={13} /></button>
                        <button type="button" className="project-manager-edit" onClick={() => editProject(item.id)} aria-label={`${item.title} ${ko.project.edit}`} title={ko.project.edit}><PencilLine size={13} /></button>
                        <button type="button" className="project-manager-delete" onClick={() => deleteProject(item.id)} disabled={workspace.projects.length <= 1} aria-label={`${item.title} 프로젝트 삭제`} title={workspace.projects.length <= 1 ? "마지막 프로젝트는 삭제할 수 없습니다" : "프로젝트 삭제"}><Trash2 size={13} /></button>
                      </div>
                      <div className="project-manager-folders">
                        {folderHierarchy([...(item.folders ?? []), ...item.documents.map((entry) => entry.folder)]).map((folder) => (
                          <div key={folder} style={{ paddingLeft: `${8 + (folder.split("/").length - 1) * 13}px` }}>
                            <Folder size={13} /><span>{folder.split("/").at(-1)}</span><small>{item.documents.filter((entry) => entry.folder === folder && !entry.deletedAt).length}</small>
                            <button type="button" onClick={() => addFolder(folder, item.id)} aria-label={`${folder} 하위 폴더 추가`} title="하위 폴더 추가"><FolderPlus size={12} /></button>
                            <button type="button" onClick={() => renameFolder(item.id, folder)} aria-label={`${folder} 이름 변경`} title="폴더 이름 변경"><PencilLine size={12} /></button>
                            <button type="button" onClick={() => deleteFolder(item.id, folder)} aria-label={`${folder} 삭제`} title="폴더 삭제"><Trash2 size={12} /></button>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
                <button type="button" className="project-manager-add" onClick={addProject}><FilePlus2 size={14} />{ko.project.add}</button>
              </div>
            )}
          </div>
        </div>
        <div className="document-tree">
          {folders.map((folder) => (
            <section key={folder}>
              <div
                className={`folder-row ${selectedFolderPath === folder ? "selected" : ""} ${dragOverFolder === folder ? "drag-over" : ""}`}
                style={{ paddingLeft: `${8 + (folder.split("/").length - 1) * 16}px` }}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragOverFolder(folder); }}
                onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOverFolder(undefined); }}
                onDrop={(event) => { event.preventDefault(); const documentId = event.dataTransfer.getData("application/x-osunnote-document") || event.dataTransfer.getData("text/plain"); if (documentId) moveDocumentToFolder(documentId, folder); }}
              >
                <button type="button" className="folder-select" onClick={() => setSelectedFolder(folder)} aria-pressed={selectedFolderPath === folder}>
                  <Folder size={16} /><span>{folder.split("/").at(-1)}</span><span>{filtered.filter((item) => item.folder === folder).length}</span>
                </button>
                <button type="button" onClick={() => addFolder(folder)} aria-label={`${folder}에 하위 폴더 추가`} title="하위 폴더 추가"><FolderPlus size={13} /></button>
              </div>
              {filtered.filter((item) => item.folder === folder).map((item) => (
                <div
                  key={item.id}
                  className={`document-row ${item.id === document?.id ? "selected" : ""}`}
                  draggable
                  onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-osunnote-document", item.id); event.dataTransfer.setData("text/plain", item.id); }}
                  onDragEnd={() => setDragOverFolder(undefined)}
                >
                  <button className="document-select" onClick={() => selectDocument(item.id)} aria-label={`${item.title} 열기`}>
                    <span className={`status-dot ${statusTone[item.status]}`} />
                    <span className="document-copy"><strong>{item.title}</strong><small>{countCharacters(item.content).toLocaleString()}자 · {statusLabel[item.status]}</small></span>
                  </button>
                  <button
                    className="document-delete"
                    onClick={() => moveToTrash(item.id)}
                    aria-label={`${item.title} 휴지통으로 이동`}
                    title="휴지통으로 이동"
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

      <main className={`editor-shell ${view !== "documents" ? "wide-view" : ""}`}>
        {view === "home" ? (
          <HomePage
            project={project}
            documents={liveDocuments}
            onNewDocument={addDocument}
            onOpenDocument={selectDocument}
            onOpenCalendar={() => setView("calendar")}
          />
        ) : view === "library" ? (
          <DocumentListPage documents={liveDocuments} onOpenDocument={selectDocument} onNewDocument={addDocument} />
        ) : view === "calendar" ? <CalendarPage /> : view === "trash" ? (
          <section className="trash-page">
            <header>
              <div><h1>휴지통</h1></div>
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
                      <button className="restore-button" onClick={() => restoreDocument(item.id)}><RotateCcw size={15} /><span>복원</span></button>
                      <button className="delete-forever-button" onClick={() => deleteForever(item.id)}><Trash2 size={15} /><span>영구 삭제</span></button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : document ? (<>
        <div className="document-header">
          <div className="breadcrumb">
            <span>{project.title}</span><span>/</span><span>{document.folder}</span><span>/</span>
            <input className="breadcrumb-title" value={document.title} onChange={(event) => updateDocument({ title: event.target.value })} aria-label="글 제목" />
          </div>
          <div className="document-header-meta"><span className={`status-pill ${statusTone[document.status]}`}>{statusLabel[document.status]}</span><span>{new Date(document.updatedAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} 수정</span></div>
          <div className="document-tools">
            <button className="tool-button" aria-label="글 저장 및 완료" onClick={() => void completeAndSaveDocument()}><Check size={16} /><span>저장</span></button>
            <button className="tool-button danger" aria-label="휴지통으로 이동" onClick={() => moveToTrash()}><Trash2 size={15} /><span>삭제</span></button>
            <button className="icon-button desktop-only" aria-label="오른쪽 패널 닫기" onClick={() => setRightOpen((value) => !value)}><PanelRightClose size={17} /></button>
          </div>
        </div>
        <article className="editor">
          <textarea ref={editorRef} value={document.content} onChange={(event) => updateBody(event.target.value)} spellCheck aria-label="본문 편집기" placeholder="여기를 눌러 이야기를 시작하세요. Markdown 문법도 사용할 수 있어요." />
        </article>
        <footer className="editor-footer"><span>{characters.toLocaleString()}자</span><span>약 {Math.max(1, Math.ceil(characters / 600))}분 읽기</span><span>Markdown</span></footer>
        </>) : (
          <section className="empty-documents">
            <span><PencilLine size={25} /></span>
            <h1>아직 작성한 글이 없습니다</h1>
            <p>새 글을 만들고 이야기를 시작해 보세요.</p>
            <button type="button" onClick={addDocument}><FilePlus2 size={17} />+ 새 글 작성하기</button>
          </section>
        )}
      </main>

      <aside className={`sidebar right ${rightOpen && view === "documents" && document ? "" : "collapsed"}`}>
        {document && <>
        <div className="inspector-title"><span>{ko.details}</span><button className="icon-button" aria-label="글 정보 닫기" onClick={() => setRightOpen(false)}><X size={16} /></button></div>
        <section className="inspector-section goal-card">
          <div className="section-head"><span>오늘의 목표</span><strong>{progress}%</strong></div>
          <div className="progress"><i style={{ width: `${progress}%` }} /></div>
          <p><strong>{characters.toLocaleString()}</strong> / <input type="number" min="1" value={document.goal} onChange={(event) => updateDocument({ goal: Number(event.target.value) })} aria-label="목표 글자 수" />자</p>
        </section>
        <section className="inspector-section">
          <label>폴더</label>
          <select value={document.folder} onChange={(event) => { updateDocument({ folder: event.target.value }); setSelectedFolder(event.target.value); }}>
            {folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}
          </select>
          <label>상태</label>
          <select value={document.status} onChange={(event) => updateDocument({ status: event.target.value as DocumentStatus })}>
            {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <label>태그</label>
          <div className="tags">{document.tags.map((tag) => <button key={tag} onClick={() => updateDocument({ tags: document.tags.filter((item) => item !== tag) })}>#{tag}<X size={11} /></button>)}<button className="add-tag" onClick={() => { const tag = window.prompt("새 태그 이름"); if (tag?.trim()) updateDocument({ tags: [...new Set([...document.tags, tag.trim()])] }); }}>+ 추가</button></div>
        </section>
        <section className="inspector-section version-section">
          <div className="section-head"><span>{ko.versions}</span><small>최근 {document.versions.length}개</small></div>
          {document.versions.length === 0 ? <p className="muted">글을 수정하면 이전 내용이 여기에 안전하게 남습니다.</p> : (
            <div className="version-list">
              {document.versions.map((version) => (
                <button className="version-row" key={version.id} onClick={() => restoreVersion(version.content)}>
                  <ArchiveRestore size={15} /><span>{new Date(version.savedAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span><small>{countCharacters(version.content)}자</small>
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="inspector-section export-card">
          <Sparkles size={19} /><div><strong>내 글은 내 것으로</strong><p>언제든 표준 형식으로 보관하세요.</p></div>
          <button onClick={() => download(`${document.title}.txt`, document.content)}><Download size={15} />{ko.export}</button>
        </section>
        </>}
      </aside>
      {!rightOpen && !focus && view === "documents" && document && <button className="edge-open right-open" onClick={() => setRightOpen(true)} aria-label="오른쪽 패널 열기"><Settings2 size={18} /></button>}

      {editingProjectId && (
        <div className="project-edit-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setEditingProjectId(undefined); }}>
          <form className="project-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="project-edit-title" onSubmit={(event) => { event.preventDefault(); saveProjectEdit(); }}>
            <header>
              <div><span>프로젝트 설정</span><h1 id="project-edit-title">프로젝트 정보 수정</h1></div>
              <button type="button" aria-label="프로젝트 수정 닫기" onClick={() => setEditingProjectId(undefined)}><X size={17} /></button>
            </header>
            <label htmlFor="project-name">프로젝트 이름</label>
            <input id="project-name" value={projectTitleDraft} onChange={(event) => setProjectTitleDraft(event.target.value)} autoFocus required />
            <label htmlFor="project-description">프로젝트 설명</label>
            <textarea id="project-description" value={projectDescriptionDraft} onChange={(event) => setProjectDescriptionDraft(event.target.value)} placeholder="프로젝트에 대한 설명을 입력하세요" rows={4} />
            <div className="project-edit-actions">
              <button type="button" onClick={() => setEditingProjectId(undefined)}>취소</button>
              <button type="submit" disabled={!projectTitleDraft.trim()}>저장</button>
            </div>
          </form>
        </div>
      )}

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
              <article><span><Keyboard size={19} /></span><div><strong>3. 빠르게 찾고 추가하기</strong><p><kbd>⌘K</kbd>로 검색하고 <kbd>⌘⌥N</kbd>으로 새 글을 만드세요.</p></div></article>
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
