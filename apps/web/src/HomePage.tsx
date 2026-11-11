import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, CalendarDays, CheckSquare, ChevronRight, Columns3, FileText, GripVertical,
  Heading2, Image, LayoutDashboard, List, ListChecks, Minus, Plus, Table2, Trash2,
  Type, WalletCards, X,
} from "lucide-react";
import {
  countCharacters, makeId,
  type DatabaseView, type HomeBlock, type HomeBlockType, type HomePageData,
  type HomeWidget, type HomeWidgetType, type HomeWorkspace,
  type Project, type TodoItem, type WritingDocument,
} from "@osunnote/domain";

interface HomePageProps {
  project: Project;
  documents: WritingDocument[];
  home: HomeWorkspace;
  todos: TodoItem[];
  onChange: (home: HomeWorkspace) => void;
  onTodosChange: (todos: TodoItem[]) => void;
  onProjectTitleChange: (title: string) => void;
  onOpenDocument: (id: string) => void;
  onOpenLibrary: () => void;
  onOpenCalendar: () => void;
  onOpenTodo: () => void;
}

const commands: Array<{ type: HomeBlockType; label: string; description: string; icon: typeof Type }> = [
  { type: "text", label: "텍스트", description: "일반 문장을 작성합니다", icon: Type },
  { type: "heading", label: "제목", description: "큰 제목을 추가합니다", icon: Heading2 },
  { type: "checklist", label: "체크리스트", description: "완료할 항목을 만듭니다", icon: CheckSquare },
  { type: "table", label: "표", description: "행과 열로 내용을 정리합니다", icon: Table2 },
  { type: "image", label: "이미지", description: "기기의 이미지를 첨부합니다", icon: Image },
  { type: "divider", label: "구분선", description: "내용 사이를 구분합니다", icon: Minus },
  { type: "subpage", label: "하위 페이지", description: "현재 페이지 아래에 새 페이지를 만듭니다", icon: FileText },
  { type: "database", label: "데이터베이스", description: "리스트·보드·표·캘린더 뷰를 만듭니다", icon: LayoutDashboard },
];

const widgetLabels: Record<HomeWidgetType, string> = { tasks: "To Do List", "completed-tasks": "완료한 일", upcoming: "다가오는 일정", "recent-documents": "최근 문서", finance: "가계부 요약" };

const createBlock = (type: HomeBlockType): HomeBlock => ({
  id: makeId(), type, content: "",
  ...(type === "table" ? { rows: [["", ""], ["", ""]] } : {}),
  ...(type === "database" ? { databaseView: "list" as DatabaseView } : {}),
});

export function HomePage({ project, documents, home, todos, onChange, onTodosChange, onProjectTitleChange, onOpenDocument, onOpenLibrary, onOpenCalendar, onOpenTodo }: HomePageProps) {
  const projectPages = home.pages.filter((item) => item.projectId === project.id);
  const page = projectPages.find((item) => item.id === home.activePageId) ?? projectPages.find((item) => !item.parentId) ?? projectPages[0]!;
  const isProjectRoot = !page.parentId;
  const [slashBlockId, setSlashBlockId] = useState<string>();
  const [draggedBlockId, setDraggedBlockId] = useState<string>();
  const [draggedWidgetId, setDraggedWidgetId] = useState<string>();
  const [widgetDropTargetId, setWidgetDropTargetId] = useState<string>();
  const [widgetMenuOpen, setWidgetMenuOpen] = useState(false);
  const [todoComposerOpen, setTodoComposerOpen] = useState(false);
  const [todoTitle, setTodoTitle] = useState("");
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const widgetMenuRef = useRef<HTMLDivElement>(null);
  const recent = useMemo(() => [...documents].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4), [documents]);

  useEffect(() => {
    if (!widgetMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!widgetMenuRef.current?.contains(event.target as Node)) setWidgetMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [widgetMenuOpen]);

  const updatePage = (patch: Partial<HomePageData>) => {
    const now = Date.now();
    onChange({ ...home, pages: home.pages.map((item) => item.id === page.id ? { ...item, ...patch, updatedAt: now } : item) });
  };
  const updateBlock = (blockId: string, patch: Partial<HomeBlock>) => updatePage({ blocks: page.blocks.map((block) => block.id === blockId ? { ...block, ...patch } : block) });

  const addBlock = (type: HomeBlockType = "text", afterId?: string, openCommandMenu = false) => {
    if (type === "subpage") {
      const now = Date.now();
      const childId = makeId();
      const child: HomePageData = { id: childId, projectId: project.id, title: "제목 없는 페이지", icon: "◻", parentId: page.id, blocks: [createBlock("text")], widgets: [], createdAt: now, updatedAt: now };
      const linked = { ...createBlock("subpage"), content: child.title, linkedPageId: childId };
      const index = afterId ? page.blocks.findIndex((block) => block.id === afterId) + 1 : page.blocks.length;
      const blocks = [...page.blocks]; blocks.splice(Math.max(0, index), 0, linked);
      onChange({ ...home, activePageId: childId, pages: [...home.pages.map((item) => item.id === page.id ? { ...item, blocks, updatedAt: now } : item), child] });
      setSlashBlockId(undefined); return;
    }
    const block = createBlock(type);
    const index = afterId ? page.blocks.findIndex((item) => item.id === afterId) + 1 : page.blocks.length;
    const blocks = [...page.blocks]; blocks.splice(Math.max(0, index), 0, block);
    updatePage({ blocks }); setSlashBlockId(openCommandMenu ? block.id : undefined);
  };

  const convertBlock = (blockId: string, type: HomeBlockType) => {
    if (type === "subpage") {
      const now = Date.now();
      const childId = makeId();
      const child: HomePageData = { id: childId, projectId: project.id, title: "제목 없는 페이지", icon: "◻", parentId: page.id, blocks: [createBlock("text")], widgets: [], createdAt: now, updatedAt: now };
      const linked: HomeBlock = { ...createBlock("subpage"), id: blockId, content: child.title, linkedPageId: childId };
      onChange({ ...home, activePageId: childId, pages: [...home.pages.map((item) => item.id === page.id ? { ...item, blocks: item.blocks.map((block) => block.id === blockId ? linked : block), updatedAt: now } : item), child] });
      setSlashBlockId(undefined);
      return;
    }
    const defaults = createBlock(type);
    updateBlock(blockId, { ...defaults, id: blockId, content: "" }); setSlashBlockId(undefined);
  };

  const moveBlock = (targetId: string) => {
    if (!draggedBlockId || draggedBlockId === targetId) return;
    const blocks = [...page.blocks];
    const from = blocks.findIndex((item) => item.id === draggedBlockId); const to = blocks.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = blocks.splice(from, 1); blocks.splice(to, 0, moved!);
    updatePage({ blocks }); setDraggedBlockId(undefined);
  };

  const addWidget = (type: HomeWidgetType) => {
    if (page.widgets.some((widget) => widget.type === type)) return;
    const occupied = new Set(page.widgets.map((widget, index) => widget.gridSlot ?? index));
    let gridSlot = 0;
    while (occupied.has(gridSlot)) gridSlot += 1;
    updatePage({ widgets: [...page.widgets, { id: makeId(), type, size: "small", gridSlot }] }); setWidgetMenuOpen(false);
  };
  const moveWidget = (targetId: string) => {
    if (!draggedWidgetId || draggedWidgetId === targetId) return;
    const from = page.widgets.findIndex((item) => item.id === draggedWidgetId);
    const to = page.widgets.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const fromSlot = page.widgets[from]!.gridSlot ?? from;
    const toSlot = page.widgets[to]!.gridSlot ?? to;
    updatePage({ widgets: page.widgets.map((widget, index) => index === from ? { ...widget, gridSlot: toSlot } : index === to ? { ...widget, gridSlot: fromSlot } : widget) });
    setDraggedWidgetId(undefined);
  };

  const moveWidgetToSlot = (gridSlot: number) => {
    if (!draggedWidgetId) return;
    updatePage({ widgets: page.widgets.map((widget) => widget.id === draggedWidgetId ? { ...widget, gridSlot } : widget) });
    setDraggedWidgetId(undefined); setWidgetDropTargetId(undefined);
  };

  const applyTemplate = (template: string) => {
    if (!template) return;
    if (page.blocks.some((block) => block.content.trim()) && !window.confirm("현재 페이지 내용을 템플릿으로 바꿀까요?")) return;
    const blocks = template === "weekly" ? [
      { ...createBlock("heading"), content: "이번 주 목표" }, { ...createBlock("checklist"), content: "" },
      { ...createBlock("heading"), content: "메모" }, createBlock("text"),
    ] : template === "project" ? [
      { ...createBlock("heading"), content: "프로젝트 개요" }, createBlock("text"),
      { ...createBlock("heading"), content: "다음 단계" }, { ...createBlock("checklist"), content: "" },
    ] : [createBlock("text")];
    updatePage({ blocks });
  };

  const readImage = (blockId: string, file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => updateBlock(blockId, { imageData: typeof reader.result === "string" ? reader.result : undefined, content: file.name });
    reader.readAsDataURL(file);
  };

  const renderBlock = (block: HomeBlock) => {
    if (block.type === "divider") return <hr className="workspace-divider" />;
    if (block.type === "subpage") return <button className="workspace-subpage" type="button" onClick={() => block.linkedPageId && onChange({ ...home, activePageId: block.linkedPageId })}><FileText size={17} /><span>{home.pages.find((item) => item.id === block.linkedPageId)?.title ?? block.content}</span><ChevronRight size={15} /></button>;
    if (block.type === "checklist") return <label className="workspace-check"><input type="checkbox" checked={Boolean(block.checked)} onChange={(event) => updateBlock(block.id, { checked: event.target.checked })} /><textarea value={block.content} onChange={(event) => updateBlock(block.id, { content: event.target.value })} placeholder="할 일을 입력하세요" rows={1} /></label>;
    if (block.type === "table") return <div className="workspace-table-wrap"><table><tbody>{(block.rows ?? [["", ""]]).map((row, rowIndex) => <tr key={`${block.id}-${rowIndex}`}>{row.map((cell, columnIndex) => <td key={`${block.id}-${rowIndex}-${columnIndex}`}><input value={cell} onChange={(event) => { const rows = (block.rows ?? []).map((current) => [...current]); rows[rowIndex]![columnIndex] = event.target.value; updateBlock(block.id, { rows }); }} placeholder="내용" /></td>)}</tr>)}</tbody></table><div><button type="button" onClick={() => updateBlock(block.id, { rows: [...(block.rows ?? []), Array(block.rows?.[0]?.length ?? 2).fill("")] })}><Plus size={13} />행</button><button type="button" onClick={() => updateBlock(block.id, { rows: (block.rows ?? []).map((row) => [...row, ""]) })}><Plus size={13} />열</button></div></div>;
    if (block.type === "image") return <div className="workspace-image-block">{block.imageData ? <img src={block.imageData} alt={block.content || "첨부 이미지"} /> : <button type="button" onClick={() => fileInputRefs.current[block.id]?.click()}><Image size={22} />이미지 선택</button>}<input ref={(element) => { fileInputRefs.current[block.id] = element; }} hidden type="file" accept="image/*" onChange={(event) => readImage(block.id, event.target.files?.[0])} />{block.imageData && <input value={block.content} onChange={(event) => updateBlock(block.id, { content: event.target.value })} placeholder="이미지 설명" />}</div>;
    if (block.type === "database") {
      const views: Array<{ id: DatabaseView; label: string; icon: typeof List }> = [{ id: "list", label: "리스트", icon: List }, { id: "board", label: "보드", icon: Columns3 }, { id: "table", label: "표", icon: Table2 }, { id: "calendar", label: "캘린더", icon: CalendarDays }];
      return <div className="workspace-database"><input value={block.content} onChange={(event) => updateBlock(block.id, { content: event.target.value })} placeholder="데이터베이스 이름" /><nav>{views.map((view) => <button type="button" key={view.id} className={block.databaseView === view.id ? "active" : ""} onClick={() => updateBlock(block.id, { databaseView: view.id })}><view.icon size={13} />{view.label}</button>)}</nav><p>데이터 항목 연결 구조가 준비되었습니다. 할 일·문서 모듈이 연결되면 실제 항목이 표시됩니다.</p></div>;
    }
    if (block.type === "heading") return <input className="workspace-heading-input" value={block.content} onChange={(event) => { const content = event.target.value; updateBlock(block.id, { content }); setSlashBlockId(content.startsWith("/") ? block.id : undefined); }} placeholder="제목" />;
    return <textarea className="workspace-text-input" value={block.content} onChange={(event) => { const content = event.target.value; updateBlock(block.id, { content }); setSlashBlockId(content.startsWith("/") ? block.id : undefined); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); addBlock("text", block.id); } }} placeholder="내용을 입력하거나 ‘/’를 눌러 블록 추가" rows={1} />;
  };

  const saveTodo = () => {
    const title = todoTitle.trim();
    if (!title) return;
    const now = Date.now();
    onTodosChange([{ id: makeId(), title, completed: false, createdAt: now, updatedAt: now }, ...todos]);
    setTodoTitle("");
    setTodoComposerOpen(false);
  };

  const openWidgetPage = (type: HomeWidgetType) => {
    if (type === "tasks" || type === "completed-tasks") onOpenTodo();
    else if (type === "upcoming") onOpenCalendar();
    else if (type === "recent-documents") onOpenLibrary();
  };

  const renderWidget = (widget: HomeWidget) => {
    const unavailable = widget.type === "finance";
    const openTodos = todos.filter((todo) => !todo.completed).slice(0, 4);
    const completedTodos = todos.filter((todo) => todo.completed).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
    const index = page.widgets.findIndex((item) => item.id === widget.id);
    const gridSlot = widget.gridSlot ?? index;
    return (
      <article style={{ gridColumnStart: gridSlot % 3 + 1, gridRowStart: Math.floor(gridSlot / 3) + 1 }} className={`workspace-widget size-${widget.size} ${widgetDropTargetId === widget.id ? "drop-target" : ""}`} key={widget.id} draggable onDragStart={() => setDraggedWidgetId(widget.id)} onDragEnd={() => { setDraggedWidgetId(undefined); setWidgetDropTargetId(undefined); }} onDragOver={(event) => { event.preventDefault(); if (draggedWidgetId && draggedWidgetId !== widget.id) setWidgetDropTargetId(widget.id); }} onDragLeave={() => setWidgetDropTargetId(undefined)} onDrop={() => { moveWidget(widget.id); setWidgetDropTargetId(undefined); }}>
        <header>
          <GripVertical size={14} /><strong>{widgetLabels[widget.type]}</strong>{unavailable && <span>준비 중</span>}
          <button type="button" title={unavailable ? "준비 중" : `${widgetLabels[widget.type]} 열기`} aria-label={unavailable ? "가계부 준비 중" : `${widgetLabels[widget.type]} 페이지 열기`} disabled={unavailable} onClick={() => openWidgetPage(widget.type)}><ArrowRight size={14} /></button>
          <button type="button" title="위젯 삭제" onClick={() => updatePage({ widgets: page.widgets.filter((item) => item.id !== widget.id) })}><X size={14} /></button>
        </header>
        {widget.type === "recent-documents" && (recent.length > 0 ? <div className="widget-document-list">{recent.map((document) => <button type="button" key={document.id} onClick={() => onOpenDocument(document.id)}><FileText size={14} /><span><strong>{document.title}</strong><small>{document.folder} · {countCharacters(document.content).toLocaleString()}자</small></span><ArrowRight size={13} /></button>)}</div> : <p>최근 작성한 글이 없습니다.</p>)}
        {widget.type === "upcoming" && <div className="widget-empty"><CalendarDays size={20} /><p>등록된 일정이 없습니다.</p><button type="button" onClick={onOpenCalendar}>캘린더 열기</button></div>}
        {widget.type === "tasks" && (openTodos.length > 0 ? <div className="widget-todo-list">{openTodos.map((todo) => <label key={todo.id}><input type="checkbox" checked={todo.completed} onChange={() => onTodosChange(todos.map((item) => item.id === todo.id ? { ...item, completed: true, updatedAt: Date.now() } : item))} /><span>{todo.title}</span></label>)}<button type="button" onClick={() => setTodoComposerOpen(true)}>할 일 추가</button></div> : <div className="widget-empty"><ListChecks size={20} /><p>할 일이 없습니다.</p><button type="button" onClick={() => setTodoComposerOpen(true)}>할 일 추가</button></div>)}
        {widget.type === "completed-tasks" && (completedTodos.length > 0 ? <div className="widget-todo-list completed">{completedTodos.map((todo) => <label key={todo.id}><input type="checkbox" checked onChange={() => onTodosChange(todos.map((item) => item.id === todo.id ? { ...item, completed: false, updatedAt: Date.now() } : item))} /><span>{todo.title}</span></label>)}</div> : <div className="widget-empty"><CheckSquare size={20} /><p>완료한 일이 없습니다.</p></div>)}
        {widget.type === "finance" && <div className="widget-empty"><WalletCards size={20} /><p>가계부 모듈 연결 후 이번 달 요약이 표시됩니다.</p></div>}
        {widget.type === "tasks" && todoComposerOpen && <form className="widget-todo-composer" onPointerDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); saveTodo(); }}><label htmlFor="dashboard-todo-title">새 할 일</label><input id="dashboard-todo-title" value={todoTitle} onChange={(event) => setTodoTitle(event.target.value)} placeholder="할 일을 입력하세요" autoFocus /><div><button type="button" onClick={() => { setTodoComposerOpen(false); setTodoTitle(""); }}>취소</button><button type="submit" disabled={!todoTitle.trim()}>저장</button></div></form>}
      </article>
    );
  };

  return <section className="workspace-home">
    <main className="workspace-canvas">
      {page.cover && <div className="workspace-cover" style={{ backgroundImage: `url(${page.cover})` }} />}
      <div className="workspace-page-toolbar"><button type="button" onClick={() => { const icon = window.prompt("페이지 아이콘", page.icon); if (icon !== null) updatePage({ icon: icon.trim().slice(0, 2) || "◻" }); }}>아이콘</button><button type="button" onClick={() => { const cover = window.prompt("커버 이미지 URL", page.cover ?? ""); if (cover !== null) updatePage({ cover: cover.trim() || undefined }); }}>커버</button><select defaultValue="" onChange={(event) => { applyTemplate(event.target.value); event.target.value = ""; }} aria-label="페이지 템플릿"><option value="" disabled>템플릿</option><option value="blank">빈 페이지</option><option value="weekly">주간 계획</option><option value="project">프로젝트 개요</option></select></div>
      <button type="button" className="workspace-page-icon" onClick={() => { const icon = window.prompt("페이지 아이콘", page.icon); if (icon !== null) updatePage({ icon: icon.trim().slice(0, 2) || "◻" }); }}>{page.icon}</button>
      <input className="workspace-page-title" value={isProjectRoot ? project.title : page.title} onChange={(event) => isProjectRoot ? onProjectTitleChange(event.target.value) : updatePage({ title: event.target.value })} aria-label={isProjectRoot ? "프로젝트 이름" : "페이지 제목"} />
      <section className="workspace-blocks" aria-label="페이지 블록">{page.blocks.map((block) => <div className={`workspace-block type-${block.type}`} key={block.id} draggable onDragStart={() => setDraggedBlockId(block.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => moveBlock(block.id)}><div className="workspace-block-controls"><button type="button" aria-label="블록 이동"><GripVertical size={15} /></button><button type="button" onClick={() => addBlock("text", block.id)} aria-label="아래에 블록 추가"><Plus size={15} /></button></div><div className="workspace-block-content">{renderBlock(block)}{slashBlockId === block.id && <div className="slash-menu">{commands.filter((command) => !block.content.slice(1) || command.label.includes(block.content.slice(1))).map((command) => <button type="button" key={command.type} onClick={() => convertBlock(block.id, command.type)}><command.icon size={17} /><span><strong>{command.label}</strong><small>{command.description}</small></span></button>)}</div>}</div><button type="button" className="workspace-block-delete" onClick={() => updatePage({ blocks: page.blocks.filter((item) => item.id !== block.id) })} aria-label="블록 삭제"><Trash2 size={14} /></button></div>)}<button type="button" className="workspace-add-block" onClick={() => addBlock("text", undefined, true)}><Plus size={15} />블록 추가</button></section>
      <section className="workspace-widget-section"><header><div><h2>대시보드</h2></div><div ref={widgetMenuRef}><button type="button" onClick={() => setWidgetMenuOpen((value) => !value)}><Plus size={14} />위젯 추가</button>{widgetMenuOpen && <div className="widget-add-menu">{(Object.keys(widgetLabels) as HomeWidgetType[]).map((type) => <button type="button" key={type} onClick={() => addWidget(type)} disabled={page.widgets.some((widget) => widget.type === type)}>{widgetLabels[type]}</button>)}</div>}</div></header><div className={`workspace-widget-grid ${draggedWidgetId ? "is-dragging" : ""}`}>{page.widgets.map(renderWidget)}{Array.from({ length: Math.max(6, Math.ceil(((Math.max(-1, ...page.widgets.map((widget, index) => widget.gridSlot ?? index)) + 2) / 3)) * 3) }, (_, gridSlot) => page.widgets.some((widget, index) => (widget.gridSlot ?? index) === gridSlot) ? null : <div style={{ gridColumnStart: gridSlot % 3 + 1, gridRowStart: Math.floor(gridSlot / 3) + 1 }} className={`workspace-widget-drop-slot ${widgetDropTargetId === `empty-${gridSlot}` ? "active" : ""}`} key={gridSlot} onDragOver={(event) => { event.preventDefault(); setWidgetDropTargetId(`empty-${gridSlot}`); }} onDragLeave={() => setWidgetDropTargetId(undefined)} onDrop={() => moveWidgetToSlot(gridSlot)}><span>여기에 놓기</span></div>)}</div></section>
    </main>
  </section>;
}
