import { createHomeWorkspace, type HomeWorkspace, type Workspace } from "@osunnote/domain";

const DB_NAME = "osunnote-local";
const STORE_NAME = "workspace";
const KEY = "primary";
const BACKUP_KEY = "backup";
const DATABASE_VERSION = 2;

let databasePromise: Promise<IDBDatabase> | undefined;
let pendingWrite: Promise<void> = Promise.resolve();

const isWorkspace = (value: unknown): value is Workspace => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Workspace>;
  if (
    typeof candidate.revision !== "number"
    || typeof candidate.activeProjectId !== "string"
    || typeof candidate.activeDocumentId !== "string"
    || !Array.isArray(candidate.projects)
    || candidate.projects.length === 0
  ) return false;

  return candidate.projects.every((project) =>
    project
    && typeof project.id === "string"
    && typeof project.title === "string"
    && Array.isArray(project.documents)
    && project.documents.every((document) =>
      document
      && typeof document.id === "string"
      && typeof document.title === "string"
      && typeof document.content === "string"
      && typeof document.folder === "string"
      && Array.isArray(document.tags)
      && Array.isArray(document.versions),
    ),
  );
};

const normalizeWorkspace = (workspace: Workspace): Workspace => ({
  ...workspace,
  home: normalizeHomeWorkspace(workspace.home),
  projects: workspace.projects.map((project) => {
    const storedFolders = Array.isArray(project.folders) ? project.folders.filter((folder): folder is string => typeof folder === "string") : [];
    const folders = [...new Set([...storedFolders, ...project.documents.map((document) => document.folder)])];
    return { ...project, folders };
  }),
});

const normalizeHomeWorkspace = (home: HomeWorkspace | undefined): HomeWorkspace => {
  if (!home || !Array.isArray(home.pages) || home.pages.length === 0) return createHomeWorkspace();
  const pages = home.pages.filter((page) => page && typeof page.id === "string" && typeof page.title === "string").map((page) => ({
    ...page,
    icon: typeof page.icon === "string" ? page.icon : "✦",
    blocks: Array.isArray(page.blocks) ? page.blocks : [],
    widgets: Array.isArray(page.widgets) ? page.widgets : [],
  }));
  if (pages.length === 0) return createHomeWorkspace();
  return {
    pages,
    activePageId: pages.some((page) => page.id === home.activePageId) ? home.activePageId : pages[0]!.id,
    theme: home.theme === "dark" ? "dark" : "light",
  };
};

const openDatabase = (): Promise<IDBDatabase> => {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        databasePromise = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      databasePromise = undefined;
      reject(request.error);
    };
    request.onblocked = () => {
      databasePromise = undefined;
      reject(new Error("IndexedDB upgrade was blocked"));
    };
  });
  return databasePromise;
};

export const readWorkspace = async (): Promise<Workspace | undefined> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const primaryRequest = store.get(KEY);
    const backupRequest = store.get(BACKUP_KEY);
    transaction.oncomplete = () => {
      if (isWorkspace(primaryRequest.result)) return resolve(normalizeWorkspace(primaryRequest.result));
      if (isWorkspace(backupRequest.result)) return resolve(normalizeWorkspace(backupRequest.result));
      if (primaryRequest.result === undefined && backupRequest.result === undefined) return resolve(undefined);
      reject(new Error("Stored workspace is invalid"));
    };
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("Workspace read was aborted"));
  });
};

const performWrite = async (workspace: Workspace): Promise<void> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const currentRequest = store.get(KEY);
    currentRequest.onsuccess = () => {
      if (isWorkspace(currentRequest.result)) store.put(currentRequest.result, BACKUP_KEY);
      store.put(workspace, KEY);
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("Workspace write was aborted"));
  });
};

export const writeWorkspace = (workspace: Workspace): Promise<void> => {
  const snapshot = structuredClone(workspace);
  const operation = pendingWrite.catch(() => undefined).then(() => performWrite(snapshot));
  pendingWrite = operation;
  return operation;
};
