import { useMemo, useRef, useState } from "react";
import {
  ArrowRight, CalendarDays, CheckSquare, ChevronRight, Columns3, FileText, GripVertical,
  Heading2, Image, LayoutDashboard, List, ListChecks, Minus, Plus, Rows3, Table2, Trash2,
  Type, WalletCards, X,
} from "lucide-react";
import {
  countCharacters, makeId,
  type DatabaseView, type HomeBlock, type HomeBlockType, type HomePageData,
  type HomeWidget, type HomeWidgetSize, type HomeWidgetType, type HomeWorkspace,
  type Project, type WritingDocument,
} from "@osunnote/domain";

interface HomePageProps {
  project: Project;
  documents: WritingDocument[];
  home: HomeWorkspace;
  onChange: (home: HomeWorkspace) => void;
  onProjectTitleChange: (title: string) => void;
  onOpenDocument: (id: string) => void;
  onOpenCalendar: () => void;
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

const widgetLabels: Record<HomeWidgetType, string> = { tasks: "오늘의 할 일", upcoming: "다가오는 일정", "recent-documents": "최근 문서", finance: "가계부 요약" };
const nextWidgetSize: Record<HomeWidgetSize, HomeWidgetSize> = { small: "medium", medium: "wide", wide: "small" };

const createBlock = (type: HomeBlockType): HomeBlock => ({
  id: makeId(), type, content: "",
  ...(type === "table" ? { rows: [["", ""], ["", ""]] } : {}),
  ...(type === "database" ? { databaseView: "list" as DatabaseView } : {}),
});

export function HomePage({ project, documents, home, onChange, onProjectTitleChange, onOpenDocument, onOpenCalendar }: HomePageProps) {
  const projectPages = home.pages.filter((item) => item.projectId === project.id);
  const page = projectPages.find((item) => item.id === home.activePageId) ?? projectPages.find((item) => !item.parentId) ?? projectPages[0]!;
  const isProjectRoot = !page.parentId;
  const [slashBlockId, setSlashBlockId] = useState<string>();
  const [draggedBlockId, setDraggedBlockId] = useState<string>();
  const [draggedWidgetId, setDraggedWidgetId] = useState<string>();
  const [widgetMenuOpen, setWidgetMenuOpen] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const recent = useMemo(() => [...documents].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4), [documents]);

  const updatePage = (patch: Partial<HomePageData>) => {
    const now = Date.now();
    onChange({ ...home, pages: home.pages.map((item) => item.id === page.id ? { ...item, ...patch, updatedAt: now } : item) });
  };
  const updateBlock = (blockId: string, patch: Partial<HomeBlock>) => updatePage({ blocks: page.blocks.map((block) => block.id === blockId ? { ...block, ...patch } : block) });

  const addBlock = (type: HomeBlockType = "text", afterId?: string) => {
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
    updatePage({ blocks }); setSlashBlockId(undefined);
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
    updatePage({ widgets: [...page.widgets, { id: makeId(), type, size: type === "recent-documents" ? "medium" : "small" }] }); setWidgetMenuOpen(false);
  };
  const moveWidget = (targetId: string) => {
    if (!draggedWidgetId || draggedWidgetId === targetId) return;
    const widgets = [...page.widgets]; const from = widgets.findIndex((item) => item.id === draggedWidgetId); const to = widgets.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = widgets.splice(from, 1); widgets.splice(to, 0, moved!); updatePage({ widgets }); setDraggedWidgetId(undefined);
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

  const renderWidget = (widget: HomeWidget) => {
    const unavailable = widget.type === "tasks" || widget.type === "finance";
    return <article className={`workspace-widget size-${widget.size}`} key={widget.id} draggable onDragStart={() => setDraggedWidgetId(widget.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => moveWidget(widget.id)}><header><GripVertical size={14} /><strong>{widgetLabels[widget.type]}</strong>{unavailable && <span>준비 중</span>}<button type="button" title="크기 변경" onClick={() => updatePage({ widgets: page.widgets.map((item) => item.id === widget.id ? { ...item, size: nextWidgetSize[item.size] } : item) })}><Rows3 size={14} /></button><button type="button" title="위젯 삭제" onClick={() => updatePage({ widgets: page.widgets.filter((item) => item.id !== widget.id) })}><X size={14} /></button></header>{widget.type === "recent-documents" && (recent.length > 0 ? <div className="widget-document-list">{recent.map((document) => <button type="button" key={document.id} onClick={() => onOpenDocument(document.id)}><FileText size={14} /><span><strong>{document.title}</strong><small>{document.folder} · {countCharacters(document.content).toLocaleString()}자</small></span><ArrowRight size={13} /></button>)}</div> : <p>최근 작성한 글이 없습니다.</p>)}{widget.type === "upcoming" && <div className="widget-empty"><CalendarDays size={20} /><p>등록된 일정이 없습니다.</p><button type="button" onClick={onOpenCalendar}>캘린더 열기</button></div>}{widget.type === "tasks" && <div className="widget-empty"><ListChecks size={20} /><p>할 일 모듈 연결 후 오늘의 작업이 표시됩니다.</p></div>}{widget.type === "finance" && <div className="widget-empty"><WalletCards size={20} /><p>가계부 모듈 연결 후 이번 달 요약이 표시됩니다.</p></div>}</article>;
  };

  return <section className="workspace-home">
    <main className="workspace-canvas">
      {page.cover && <div className="workspace-cover" style={{ backgroundImage: `url(${page.cover})` }} />}
      <div className="workspace-page-toolbar"><button type="button" onClick={() => { const icon = window.prompt("페이지 아이콘", page.icon); if (icon !== null) updatePage({ icon: icon.trim().slice(0, 2) || "◻" }); }}>아이콘</button><button type="button" onClick={() => { const cover = window.prompt("커버 이미지 URL", page.cover ?? ""); if (cover !== null) updatePage({ cover: cover.trim() || undefined }); }}>커버</button><select defaultValue="" onChange={(event) => { applyTemplate(event.target.value); event.target.value = ""; }} aria-label="페이지 템플릿"><option value="" disabled>템플릿</option><option value="blank">빈 페이지</option><option value="weekly">주간 계획</option><option value="project">프로젝트 개요</option></select></div>
      <button type="button" className="workspace-page-icon" onClick={() => { const icon = window.prompt("페이지 아이콘", page.icon); if (icon !== null) updatePage({ icon: icon.trim().slice(0, 2) || "◻" }); }}>{page.icon}</button>
      <input className="workspace-page-title" value={isProjectRoot ? project.title : page.title} onChange={(event) => isProjectRoot ? onProjectTitleChange(event.target.value) : updatePage({ title: event.target.value })} aria-label={isProjectRoot ? "프로젝트 이름" : "페이지 제목"} />
      <section className="workspace-blocks" aria-label="페이지 블록">{page.blocks.map((block) => <div className={`workspace-block type-${block.type}`} key={block.id} draggable onDragStart={() => setDraggedBlockId(block.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => moveBlock(block.id)}><div className="workspace-block-controls"><button type="button" aria-label="블록 이동"><GripVertical size={15} /></button><button type="button" onClick={() => addBlock("text", block.id)} aria-label="아래에 블록 추가"><Plus size={15} /></button></div><div className="workspace-block-content">{renderBlock(block)}{slashBlockId === block.id && <div className="slash-menu">{commands.filter((command) => !block.content.slice(1) || command.label.includes(block.content.slice(1))).map((command) => <button type="button" key={command.type} onClick={() => convertBlock(block.id, command.type)}><command.icon size={17} /><span><strong>{command.label}</strong><small>{command.description}</small></span></button>)}</div>}</div><button type="button" className="workspace-block-delete" onClick={() => updatePage({ blocks: page.blocks.filter((item) => item.id !== block.id) })} aria-label="블록 삭제"><Trash2 size={14} /></button></div>)}<button type="button" className="workspace-add-block" onClick={() => addBlock()}><Plus size={15} />블록 추가</button></section>
      <section className="workspace-widget-section"><header><div><h2>대시보드</h2></div><div><button type="button" onClick={() => setWidgetMenuOpen((value) => !value)}><Plus size={14} />위젯 추가</button>{widgetMenuOpen && <div className="widget-add-menu">{(Object.keys(widgetLabels) as HomeWidgetType[]).map((type) => <button type="button" key={type} onClick={() => addWidget(type)} disabled={page.widgets.some((widget) => widget.type === type)}>{widgetLabels[type]}</button>)}</div>}</div></header><div className="workspace-widget-grid">{page.widgets.map(renderWidget)}</div></section>
    </main>
  </section>;
}
