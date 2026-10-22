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
