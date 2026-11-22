const DB_NAME = 'masteryls-offline-courses';
const DB_VERSION = 1;
const STORE_NAME = 'packages';

function packageKey(courseId, ownerId) {
  return `${ownerId}:${courseId}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open offline storage.'));
  });
}

async function transact(mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const result = action(tx.objectStore(STORE_NAME));
    tx.oncomplete = () => { db.close(); resolve(result?.result); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Offline storage failed.')); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Offline storage was interrupted.')); };
  });
}

export function saveOfflineCourse(coursePackage) {
  return transact('readwrite', (store) => store.put({ ...coursePackage, key: packageKey(coursePackage.courseId, coursePackage.ownerId) }));
}

export function getOfflineCourse(courseId, ownerId) {
  return transact('readonly', (store) => store.get(packageKey(courseId, ownerId)));
}

export function listOfflineCourses() {
  return transact('readonly', (store) => store.getAll());
}

export function removeOfflineCourse(courseId, ownerId) {
  return transact('readwrite', (store) => store.delete(packageKey(courseId, ownerId)));
}

export function canOpenOfflineCourse(coursePackage, userId) {
  return Boolean(coursePackage && userId && coursePackage.ownerId === userId);
}

export async function findOfflineCourse(courseId, userId) {
  if (!courseId || !userId || typeof indexedDB === 'undefined') return null;
  const coursePackage = await getOfflineCourse(courseId, userId);
  return canOpenOfflineCourse(coursePackage, userId) ? coursePackage : null;
}
