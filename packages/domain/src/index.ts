export type DocumentStatus = "idea" | "draft" | "review" | "done";

export interface Version {
  id: string;
  content: string;
  savedAt: number;
}

export interface WritingDocument {
  id: string;
  title: string;
  content: string;
  folder: string;
  status: DocumentStatus;
  tags: string[];
  goal: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  versions: Version[];
}

export interface Project {
  id: string;
  title: string;
  description: string;
  documents: WritingDocument[];
  createdAt: number;
}

export interface Workspace {
  revision: number;
  projects: Project[];
  activeProjectId: string;
  activeDocumentId: string;
}

export const countCharacters = (text: string): number =>
  Array.from(text.replace(/\s/g, "")).length;

export const makeId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const createDocument = (title = "제목 없는 글", folder = "원고"): WritingDocument => {
  const now = Date.now();
  return {
    id: makeId(), title, content: "", folder, status: "draft", tags: [], goal: 2000,
    createdAt: now, updatedAt: now, versions: [],
  };
};

export const initialWorkspace = (): Workspace => {
  const now = Date.now();
  const opening: WritingDocument = {
    ...createDocument("비가 그친 뒤"),
    content: "# 비가 그친 뒤\n\n골목 끝에서 오래된 서점의 불이 켜졌다.\n\n나는 젖은 우산을 접으며, 오늘만큼은 그 문을 지나치지 않기로 했다.",
    tags: ["단편", "초고"],
    goal: 1200,
  };
  const characters: WritingDocument = {
    ...createDocument("등장인물", "자료"),
    content: "# 등장인물\n\n## 윤서\n비 오는 날마다 오래된 편지를 읽는 사람.\n\n## 도현\n문을 닫으려는 서점의 마지막 주인.",
    status: "idea",
    tags: ["인물"],
  };
  const project: Project = {
    id: makeId(), title: "유리창 너머의 계절", description: "도시와 기억에 관한 장편소설", createdAt: now,
    documents: [opening, characters],
  };
  return { revision: 1, projects: [project], activeProjectId: project.id, activeDocumentId: opening.id };
};

export const saveDocument = (
  workspace: Workspace,
  documentId: string,
  patch: Partial<Pick<WritingDocument, "title" | "content" | "status" | "tags" | "goal" | "folder">>,
  snapshot = false,
): Workspace => ({
  ...workspace,
  revision: workspace.revision + 1,
  projects: workspace.projects.map((project) => ({
    ...project,
    documents: project.documents.map((document) => {
      if (document.id !== documentId) return document;
      const versions = snapshot && patch.content !== undefined && patch.content !== document.content
        ? [{ id: makeId(), content: document.content, savedAt: Date.now() }, ...document.versions].slice(0, 30)
        : document.versions;
      return { ...document, ...patch, versions, updatedAt: Date.now() };
    }),
  })),
});

export const searchDocuments = (documents: WritingDocument[], query: string): WritingDocument[] => {
  const normalized = query.trim().toLocaleLowerCase("ko-KR");
  if (!normalized) return documents;
  return documents.filter((document) =>
    [document.title, document.content, document.folder, ...document.tags]
      .join(" ").toLocaleLowerCase("ko-KR").includes(normalized),
  );
};

export interface CalendarHoliday {
  date: string;
  name: string;
}

export interface CalendarDay {
  date: string;
  day: number;
  dayOfWeek: number;
  inCurrentMonth: boolean;
  holiday?: CalendarHoliday;
}

const recurringKoreanHolidays = new Map([
  ["01-01", "신정"],
  ["03-01", "삼일절"],
  ["05-05", "어린이날"],
  ["06-06", "현충일"],
  ["08-15", "광복절"],
  ["10-03", "개천절"],
  ["10-09", "한글날"],
  ["12-25", "기독탄신일"],
]);

// 우주항공청 2026년 월력요항을 기준으로 한 비고정 공휴일입니다.
const datedKoreanHolidays = new Map<string, string>([
  ["2026-02-16", "설날 연휴"],
  ["2026-02-17", "설날"],
  ["2026-02-18", "설날 연휴"],
  ["2026-03-02", "삼일절 대체공휴일"],
  ["2026-05-24", "부처님오신날"],
  ["2026-05-25", "부처님오신날 대체공휴일"],
  ["2026-06-03", "전국동시지방선거"],
  ["2026-08-17", "광복절 대체공휴일"],
  ["2026-09-24", "추석 연휴"],
  ["2026-09-25", "추석"],
  ["2026-09-26", "추석 연휴"],
  ["2026-10-05", "개천절 대체공휴일"],
]);

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

export const koreanHoliday = (date: string): CalendarHoliday | undefined => {
  const name = datedKoreanHolidays.get(date) ?? recurringKoreanHolidays.get(date.slice(5));
  return name ? { date, name } : undefined;
};

export const calendarMonth = (year: number, month: number): CalendarDay[] => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return [];
  const first = new Date(Date.UTC(year, month - 1, 1));
  const cursor = new Date(first);
  cursor.setUTCDate(cursor.getUTCDate() - cursor.getUTCDay());

  return Array.from({ length: 42 }, () => {
    const date = isoDate(cursor);
    const value: CalendarDay = {
      date,
      day: cursor.getUTCDate(),
      dayOfWeek: cursor.getUTCDay(),
      inCurrentMonth: cursor.getUTCMonth() === month - 1,
      holiday: koreanHoliday(date),
    };
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    return value;
  });
};
