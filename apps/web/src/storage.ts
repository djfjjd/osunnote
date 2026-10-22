import type { Workspace } from "@osunnote/domain";

const DB_NAME = "osunnote-local";
const STORE_NAME = "workspace";
const KEY = "primary";

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export const readWorkspace = async (): Promise<Workspace | undefined> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(KEY);
    request.onsuccess = () => resolve(request.result as Workspace | undefined);
    request.onerror = () => reject(request.error);
  });
};

export const writeWorkspace = async (workspace: Workspace): Promise<void> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(workspace, KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};
