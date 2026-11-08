import type { Workspace } from "@osunnote/domain";

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
      if (isWorkspace(primaryRequest.result)) return resolve(primaryRequest.result);
      if (isWorkspace(backupRequest.result)) return resolve(backupRequest.result);
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
