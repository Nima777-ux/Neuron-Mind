export type MountPermissionState = 'granted' | 'prompt' | 'denied';

export interface NativeDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission?: (descriptor?: {
    mode?: 'read' | 'readwrite';
  }) => Promise<MountPermissionState>;
  requestPermission?: (descriptor?: {
    mode?: 'read' | 'readwrite';
  }) => Promise<MountPermissionState>;
}

export interface NativeFileHandle extends FileSystemFileHandle {
  move?: (
    destination: FileSystemDirectoryHandle | string,
    newName?: string
  ) => Promise<void>;
}

export interface StoredFolderMount {
  id: string;
  name: string;
  handle: NativeDirectoryHandle;
  addedAt: string;
}

export interface ComputerFolderMount {
  id: string;
  name: string;
  permission: MountPermissionState;
  entryCount: number;
  addedAt: string;
  handle: NativeDirectoryHandle;
}

export interface ComputerEntryInfo {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  size?: number;
  lastModified?: string;
}

const DB_NAME = 'neuron-mind-computer-fs';
const DB_VERSION = 1;
const STORE_NAME = 'mounts';
const MAX_LIST_ENTRIES = 500;
const MAX_TEXT_READ_BYTES = 256 * 1024;
const SKIPPED_RECURSIVE_DIRS = new Set(['node_modules', '.git', '$RECYCLE.BIN', 'System Volume Information']);

export function isDirectoryPickerSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    typeof (window as Window & { showDirectoryPicker?: unknown })
      .showDirectoryPicker === 'function'
  );
}

export function isTopLevelWindowContext(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.self === window.top;
  } catch {
    return false;
  }
}

function openMountDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this environment.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open folder mount DB.'));
  });
}

export async function loadStoredFolderMounts(): Promise<StoredFolderMount[]> {
  try {
    const db = await openMountDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        resolve((req.result as StoredFolderMount[]) ?? []);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveStoredFolderMount(
  mount: StoredFolderMount
): Promise<void> {
  const db = await openMountDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(mount);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeStoredFolderMount(id: string): Promise<void> {
  const db = await openMountDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function queryMountPermission(
  handle: NativeDirectoryHandle
): Promise<MountPermissionState> {
  try {
    if (typeof handle.queryPermission === 'function') {
      return await handle.queryPermission({ mode: 'readwrite' });
    }
    return 'granted';
  } catch {
    return 'prompt';
  }
}

export async function requestMountPermission(
  handle: NativeDirectoryHandle
): Promise<MountPermissionState> {
  try {
    if (typeof handle.requestPermission === 'function') {
      return await handle.requestPermission({ mode: 'readwrite' });
    }
    return 'granted';
  } catch {
    return 'denied';
  }
}

async function iterateDirectory(
  dirHandle: NativeDirectoryHandle
): Promise<FileSystemHandle[]> {
  const items: FileSystemHandle[] = [];
  if (typeof dirHandle.values === 'function') {
    for await (const entry of dirHandle.values()) {
      items.push(entry);
    }
  } else if (typeof dirHandle.entries === 'function') {
    for await (const [, entry] of dirHandle.entries()) {
      items.push(entry);
    }
  }
  return items;
}

export async function countTopLevelEntries(
  handle: NativeDirectoryHandle,
  permission: MountPermissionState
): Promise<number> {
  if (permission !== 'granted') return 0;
  try {
    const items = await iterateDirectory(handle);
    return items.length;
  } catch {
    return 0;
  }
}

export async function pickComputerFolder(): Promise<{
  mount: StoredFolderMount;
  alreadyMounted: boolean;
}> {
  const picker = (
    window as Window & {
      showDirectoryPicker?: (opts?: {
        id?: string;
        mode?: 'read' | 'readwrite';
      }) => Promise<NativeDirectoryHandle>;
    }
  ).showDirectoryPicker;

  if (typeof picker !== 'function') {
    throw new Error('FOLDER_PICKER_UNSUPPORTED');
  }

  let handle: NativeDirectoryHandle;
  try {
    handle = await picker({
      id: 'neuron-mind-computer-folder',
      mode: 'readwrite',
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'SecurityError') {
      throw new Error('IFRAME_BLOCKED');
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('PICKER_CANCELLED');
    }
    throw error;
  }

  const perm = await queryMountPermission(handle);
  if (perm !== 'granted') {
    await requestMountPermission(handle);
  }

  const existing = await loadStoredFolderMounts();
  for (const prev of existing) {
    try {
      if (typeof prev.handle.isSameEntry === 'function') {
        const same = await prev.handle.isSameEntry(handle);
        if (same) {
          return { mount: prev, alreadyMounted: true };
        }
      } else if (prev.name === handle.name) {
        return { mount: prev, alreadyMounted: true };
      }
    } catch {
      // Ignore comparison errors on stale handles
    }
  }

  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `mount-${Date.now()}`;

  const mount: StoredFolderMount = {
    id,
    name: handle.name || 'Folder',
    handle,
    addedAt: new Date().toISOString(),
  };
  await saveStoredFolderMount(mount);
  return { mount, alreadyMounted: false };
}

function normalizeRelativePath(rawPath?: string): string[] {
  const cleaned = String(rawPath ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
  if (!cleaned || cleaned === '.') return [];

  const parts = cleaned.split('/').filter((seg) => seg && seg !== '.');
  for (const seg of parts) {
    if (seg === '..') {
      throw new Error('Parent path traversal ("..") is not permitted.');
    }
  }
  return parts;
}

interface ResolvedMountTarget {
  mount: ComputerFolderMount;
  subSegments: string[];
  displayPath: string;
}

function resolveMountAndPath(
  mounts: ComputerFolderMount[],
  rawPath?: string
): ResolvedMountTarget {
  const grantedMounts = mounts.filter((m) => m.permission === 'granted');
  if (grantedMounts.length === 0) {
    if (mounts.length > 0) {
      throw new Error(
        'Connected computer folder needs permission re-authorization. Click "Reconnect" on the folder in Files or the Assistant bar.'
      );
    }
    throw new Error(
      'No computer folder is connected yet. Click "Connect Computer Folder" in Files or Assistant first.'
    );
  }

  const segments = normalizeRelativePath(rawPath);
  if (segments.length === 0) {
    const primary = grantedMounts[0];
    return {
      mount: primary,
      subSegments: [],
      displayPath: primary.name,
    };
  }

  const firstLower = segments[0].toLowerCase();
  const matchedMount = grantedMounts.find(
    (m) => m.name.toLowerCase() === firstLower
  );

  if (matchedMount) {
    return {
      mount: matchedMount,
      subSegments: segments.slice(1),
      displayPath: [matchedMount.name, ...segments.slice(1)].join('/'),
    };
  }

  if (grantedMounts.length === 1) {
    const primary = grantedMounts[0];
    return {
      mount: primary,
      subSegments: segments,
      displayPath: [primary.name, ...segments].join('/'),
    };
  }

  const availableNames = grantedMounts.map((m) => `"${m.name}"`).join(', ');
  throw new Error(
    `Multiple computer folders are connected (${availableNames}). Prefix the path with the folder name, e.g. "${grantedMounts[0].name}/${segments.join('/')}".`
  );
}

async function getDirectoryAtSegments(
  root: NativeDirectoryHandle,
  segments: string[],
  createMissing = false
): Promise<NativeDirectoryHandle> {
  let current: NativeDirectoryHandle = root;
  for (const segment of segments) {
    current = (await current.getDirectoryHandle(segment, {
      create: createMissing,
    })) as NativeDirectoryHandle;
  }
  return current;
}

function sortEntries(entries: ComputerEntryInfo[]): ComputerEntryInfo[] {
  return [...entries].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

async function collectDirectoryEntries(
  dirHandle: NativeDirectoryHandle,
  baseDisplayPath: string,
  recursive: boolean,
  maxDepth: number,
  currentDepth = 0,
  results: ComputerEntryInfo[] = []
): Promise<{ entries: ComputerEntryInfo[]; truncated: boolean }> {
  const handles = await iterateDirectory(dirHandle);
  const levelItems: ComputerEntryInfo[] = [];

  for (const handle of handles) {
    if (results.length + levelItems.length >= MAX_LIST_ENTRIES) {
      return { entries: [...results, ...sortEntries(levelItems)], truncated: true };
    }
    const entryPath = baseDisplayPath ? `${baseDisplayPath}/${handle.name}` : handle.name;

    if (handle.kind === 'directory') {
      levelItems.push({
        name: handle.name,
        path: entryPath,
        kind: 'directory',
      });
    } else {
      let size: number | undefined;
      let lastModified: string | undefined;
      try {
        const file = await (handle as FileSystemFileHandle).getFile();
        size = file.size;
        lastModified = new Date(file.lastModified).toISOString();
      } catch {
        // Metadata optional
      }
      levelItems.push({
        name: handle.name,
        path: entryPath,
        kind: 'file',
        size,
        lastModified,
      });
    }
  }

  const sortedLevel = sortEntries(levelItems);
  for (const item of sortedLevel) {
    if (results.length >= MAX_LIST_ENTRIES) {
      return { entries: results, truncated: true };
    }
    results.push(item);

    if (
      recursive &&
      item.kind === 'directory' &&
      currentDepth + 1 < maxDepth &&
      !SKIPPED_RECURSIVE_DIRS.has(item.name)
    ) {
      const subHandle = handles.find(
        (h) => h.kind === 'directory' && h.name === item.name
      ) as NativeDirectoryHandle | undefined;
      if (subHandle) {
        const nested = await collectDirectoryEntries(
          subHandle,
          item.path,
          true,
          maxDepth,
          currentDepth + 1,
          results
        );
        if (nested.truncated) {
          return { entries: results, truncated: true };
        }
      }
    }
  }

  return { entries: results, truncated: false };
}

export async function listComputerDirectory(
  mounts: ComputerFolderMount[],
  folderPath = '',
  recursive = false,
  maxDepth = 2
): Promise<{
  success: boolean;
  path: string;
  entries: ComputerEntryInfo[];
  truncated: boolean;
  connectedMounts: string[];
}> {
  const grantedMounts = mounts.filter((m) => m.permission === 'granted');
  if (grantedMounts.length === 0) {
    throw new Error(
      mounts.length > 0
        ? 'Connected computer folder requires permission re-authorization.'
        : 'No computer folder is connected yet.'
    );
  }

  const segments = normalizeRelativePath(folderPath);
  const clampedDepth = Math.min(Math.max(Number(maxDepth) || 2, 1), 4);

  // If root "" is requested and multiple folders are connected, list all roots (and children if recursive)
  if (segments.length === 0 && grantedMounts.length > 1) {
    const entries: ComputerEntryInfo[] = [];
    let truncated = false;
    for (const mount of grantedMounts) {
      entries.push({
        name: mount.name,
        path: mount.name,
        kind: 'directory',
      });
      if (recursive) {
        const sub = await collectDirectoryEntries(
          mount.handle,
          mount.name,
          true,
          clampedDepth,
          1,
          entries
        );
        if (sub.truncated) {
          truncated = true;
          break;
        }
      }
    }
    return {
      success: true,
      path: '/',
      entries,
      truncated,
      connectedMounts: grantedMounts.map((m) => m.name),
    };
  }

  const target = resolveMountAndPath(mounts, folderPath);
  const dirHandle = await getDirectoryAtSegments(
    target.mount.handle,
    target.subSegments,
    false
  );

  const collected = await collectDirectoryEntries(
    dirHandle,
    target.displayPath,
    recursive,
    clampedDepth
  );

  return {
    success: true,
    path: target.displayPath,
    entries: collected.entries,
    truncated: collected.truncated,
    connectedMounts: grantedMounts.map((m) => m.name),
  };
}

export async function readComputerFile(
  mounts: ComputerFolderMount[],
  filePath: string
): Promise<{
  success: boolean;
  path: string;
  name: string;
  size: number;
  lastModified: string;
  content: string;
  truncated: boolean;
}> {
  const target = resolveMountAndPath(mounts, filePath);
  if (target.subSegments.length === 0) {
    throw new Error('Specify a file path inside the connected folder.');
  }

  const fileName = target.subSegments[target.subSegments.length - 1];
  const parentDir = await getDirectoryAtSegments(
    target.mount.handle,
    target.subSegments.slice(0, -1),
    false
  );
  const fileHandle = await parentDir.getFileHandle(fileName, { create: false });
  const file = await fileHandle.getFile();

  const slice = file.size > MAX_TEXT_READ_BYTES ? file.slice(0, MAX_TEXT_READ_BYTES) : file;
  const buffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < Math.min(bytes.length, 4096); i += 1) {
    if (bytes[i] === 0) {
      throw new Error(
        `File "${target.displayPath}" appears to be binary (${file.size} bytes) and cannot be read as UTF-8 text.`
      );
    }
  }

  const content = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  return {
    success: true,
    path: target.displayPath,
    name: file.name,
    size: file.size,
    lastModified: new Date(file.lastModified).toISOString(),
    content,
    truncated: file.size > MAX_TEXT_READ_BYTES,
  };
}

export async function writeComputerFile(
  mounts: ComputerFolderMount[],
  filePath: string,
  content: string,
  mode: 'overwrite' | 'append' = 'overwrite'
): Promise<{
  success: boolean;
  path: string;
  mode: 'overwrite' | 'append';
  bytesWritten: number;
}> {
  const target = resolveMountAndPath(mounts, filePath);
  if (target.subSegments.length === 0) {
    throw new Error('Specify a file path including the filename.');
  }

  const fileName = target.subSegments[target.subSegments.length - 1];
  const parentDir = await getDirectoryAtSegments(
    target.mount.handle,
    target.subSegments.slice(0, -1),
    true
  );
  const fileHandle = await parentDir.getFileHandle(fileName, { create: true });

  let nextText = content;
  if (mode === 'append') {
    try {
      const existing = await fileHandle.getFile();
      const prevText = await existing.text();
      nextText = prevText ? `${prevText}${prevText.endsWith('\n') ? '' : '\n'}${content}` : content;
    } catch {
      nextText = content;
    }
  }

  const writable = await fileHandle.createWritable();
  try {
    await writable.write(nextText);
  } finally {
    await writable.close();
  }

  return {
    success: true,
    path: target.displayPath,
    mode,
    bytesWritten: new TextEncoder().encode(nextText).byteLength,
  };
}

export async function writeComputerBinaryFile(
  mounts: ComputerFolderMount[],
  filePath: string,
  bytes: Uint8Array
): Promise<{
  success: boolean;
  path: string;
  bytesWritten: number;
}> {
  const target = resolveMountAndPath(mounts, filePath);
  if (target.subSegments.length === 0) {
    throw new Error('Specify a file path including the filename.');
  }

  const fileName = target.subSegments[target.subSegments.length - 1];
  const parentDir = await getDirectoryAtSegments(
    target.mount.handle,
    target.subSegments.slice(0, -1),
    true
  );
  const fileHandle = await parentDir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    const bufferCopy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(bufferCopy).set(bytes);
    await writable.write(bufferCopy);
  } finally {
    await writable.close();
  }

  return {
    success: true,
    path: target.displayPath,
    bytesWritten: bytes.byteLength,
  };
}

export async function createComputerFolder(
  mounts: ComputerFolderMount[],
  folderPath: string
): Promise<{
  success: boolean;
  path: string;
}> {
  const target = resolveMountAndPath(mounts, folderPath);
  if (target.subSegments.length === 0) {
    throw new Error('Specify a folder name or path to create.');
  }
  await getDirectoryAtSegments(target.mount.handle, target.subSegments, true);
  return {
    success: true,
    path: target.displayPath,
  };
}

async function copyDirectoryRecursive(
  sourceDir: NativeDirectoryHandle,
  destDir: NativeDirectoryHandle
): Promise<void> {
  const entries = await iterateDirectory(sourceDir);
  for (const entry of entries) {
    if (entry.kind === 'directory') {
      const nextDest = (await destDir.getDirectoryHandle(entry.name, {
        create: true,
      })) as NativeDirectoryHandle;
      await copyDirectoryRecursive(entry as NativeDirectoryHandle, nextDest);
    } else {
      const srcFile = await (entry as FileSystemFileHandle).getFile();
      const bytes = await srcFile.arrayBuffer();
      const destFileHandle = await destDir.getFileHandle(entry.name, {
        create: true,
      });
      const writable = await destFileHandle.createWritable();
      try {
        await writable.write(bytes);
      } finally {
        await writable.close();
      }
    }
  }
}

async function resolveExistingKind(
  parentDir: NativeDirectoryHandle,
  name: string
): Promise<'file' | 'directory'> {
  try {
    await parentDir.getFileHandle(name, { create: false });
    return 'file';
  } catch {
    await parentDir.getDirectoryHandle(name, { create: false });
    return 'directory';
  }
}

export async function moveOrRenameComputerEntry(
  mounts: ComputerFolderMount[],
  sourcePath: string,
  destinationPath: string
): Promise<{
  success: boolean;
  sourcePath: string;
  destinationPath: string;
  kind: 'file' | 'directory';
}> {
  const src = resolveMountAndPath(mounts, sourcePath);
  const dst = resolveMountAndPath(mounts, destinationPath);

  if (src.subSegments.length === 0 || dst.subSegments.length === 0) {
    throw new Error('Both sourcePath and destinationPath must point inside a connected folder.');
  }

  if (src.displayPath === dst.displayPath) {
    return {
      success: true,
      sourcePath: src.displayPath,
      destinationPath: dst.displayPath,
      kind: 'file',
    };
  }

  if (
    src.mount.id === dst.mount.id &&
    dst.displayPath.startsWith(`${src.displayPath}/`)
  ) {
    throw new Error('Cannot move a folder inside itself.');
  }

  const srcName = src.subSegments[src.subSegments.length - 1];
  const srcParent = await getDirectoryAtSegments(
    src.mount.handle,
    src.subSegments.slice(0, -1),
    false
  );
  const kind = await resolveExistingKind(srcParent, srcName);

  const dstName = dst.subSegments[dst.subSegments.length - 1];
  const dstParent = await getDirectoryAtSegments(
    dst.mount.handle,
    dst.subSegments.slice(0, -1),
    true
  );

  if (kind === 'file') {
    const srcFileHandle = (await srcParent.getFileHandle(srcName, {
      create: false,
    })) as NativeFileHandle;

    if (typeof srcFileHandle.move === 'function' && src.mount.id === dst.mount.id) {
      try {
        await srcFileHandle.move(dstParent, dstName);
        return {
          success: true,
          sourcePath: src.displayPath,
          destinationPath: dst.displayPath,
          kind: 'file',
        };
      } catch {
        // Fallback to copy + remove below
      }
    }

    const srcFile = await srcFileHandle.getFile();
    const bytes = await srcFile.arrayBuffer();
    const dstFileHandle = await dstParent.getFileHandle(dstName, { create: true });
    const writable = await dstFileHandle.createWritable();
    try {
      await writable.write(bytes);
    } finally {
      await writable.close();
    }
    await srcParent.removeEntry(srcName, { recursive: false });

    return {
      success: true,
      sourcePath: src.displayPath,
      destinationPath: dst.displayPath,
      kind: 'file',
    };
  }

  const srcDirHandle = (await srcParent.getDirectoryHandle(srcName, {
    create: false,
  })) as NativeDirectoryHandle;
  const dstDirHandle = (await dstParent.getDirectoryHandle(dstName, {
    create: true,
  })) as NativeDirectoryHandle;

  await copyDirectoryRecursive(srcDirHandle, dstDirHandle);
  await srcParent.removeEntry(srcName, { recursive: true });

  return {
    success: true,
    sourcePath: src.displayPath,
    destinationPath: dst.displayPath,
    kind: 'directory',
  };
}

export async function copyComputerFile(
  mounts: ComputerFolderMount[],
  sourcePath: string,
  destinationPath: string
): Promise<{
  success: boolean;
  sourcePath: string;
  destinationPath: string;
  bytesCopied: number;
}> {
  const src = resolveMountAndPath(mounts, sourcePath);
  const dst = resolveMountAndPath(mounts, destinationPath);
  if (src.subSegments.length === 0 || dst.subSegments.length === 0) {
    throw new Error('Specify valid source and destination file paths.');
  }

  const srcName = src.subSegments[src.subSegments.length - 1];
  const srcParent = await getDirectoryAtSegments(
    src.mount.handle,
    src.subSegments.slice(0, -1),
    false
  );
  const srcFileHandle = await srcParent.getFileHandle(srcName, { create: false });
  const srcFile = await srcFileHandle.getFile();
  const bytes = await srcFile.arrayBuffer();

  const dstName = dst.subSegments[dst.subSegments.length - 1];
  const dstParent = await getDirectoryAtSegments(
    dst.mount.handle,
    dst.subSegments.slice(0, -1),
    true
  );
  const dstFileHandle = await dstParent.getFileHandle(dstName, { create: true });
  const writable = await dstFileHandle.createWritable();
  try {
    await writable.write(bytes);
  } finally {
    await writable.close();
  }

  return {
    success: true,
    sourcePath: src.displayPath,
    destinationPath: dst.displayPath,
    bytesCopied: bytes.byteLength,
  };
}

export async function deleteComputerEntry(
  mounts: ComputerFolderMount[],
  targetPath: string,
  recursive = false
): Promise<{
  success: boolean;
  deletedPath: string;
  kind: 'file' | 'directory';
}> {
  const target = resolveMountAndPath(mounts, targetPath);
  if (target.subSegments.length === 0) {
    throw new Error(
      'Cannot delete the root mounted folder itself. Disconnect it from Files or delete items inside it.'
    );
  }

  const name = target.subSegments[target.subSegments.length - 1];
  const parentDir = await getDirectoryAtSegments(
    target.mount.handle,
    target.subSegments.slice(0, -1),
    false
  );
  const kind = await resolveExistingKind(parentDir, name);
  await parentDir.removeEntry(name, { recursive: kind === 'directory' ? recursive : false });

  return {
    success: true,
    deletedPath: target.displayPath,
    kind,
  };
}

export async function searchComputerFiles(
  mounts: ComputerFolderMount[],
  query: string,
  folderPath = '',
  searchContent = false
): Promise<{
  success: boolean;
  query: string;
  matches: Array<ComputerEntryInfo & { snippet?: string }>;
}> {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return { success: true, query, matches: [] };
  }

  const listing = await listComputerDirectory(mounts, folderPath, true, 4);
  const matches: Array<ComputerEntryInfo & { snippet?: string }> = [];

  for (const entry of listing.entries) {
    if (matches.length >= 50) break;

    if (entry.name.toLowerCase().includes(needle) || entry.path.toLowerCase().includes(needle)) {
      matches.push(entry);
      continue;
    }

    if (
      searchContent &&
      entry.kind === 'file' &&
      (entry.size ?? 0) > 0 &&
      (entry.size ?? 0) <= 128 * 1024
    ) {
      try {
        const readRes = await readComputerFile(mounts, entry.path);
        const idx = readRes.content.toLowerCase().indexOf(needle);
        if (idx !== -1) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(readRes.content.length, idx + needle.length + 80);
          matches.push({
            ...entry,
            snippet: readRes.content.slice(start, end).replace(/\s+/g, ' ').trim(),
          });
        }
      } catch {
        // Skip unreadable or binary files
      }
    }
  }

  return {
    success: true,
    query,
    matches,
  };
}

const PHOTO_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.heic', '.avif']);
const VIDEO_EXTS = new Set(['.mp4', '.mkv', '.mov', '.webm', '.avi', '.m4v']);
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac']);
const DOC_EXTS = new Set(['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf', '.csv', '.xlsx', '.pptx']);

function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

export async function compareComputerFiles(
  mounts: ComputerFolderMount[],
  firstFilePath: string,
  secondFilePath: string
): Promise<Record<string, unknown>> {
  const first = await readComputerFile(mounts, firstFilePath);
  const second = await readComputerFile(mounts, secondFilePath);

  const linesA = first.content.split(/\r?\n/);
  const linesB = second.content.split(/\r?\n/);
  const setA = new Set(linesA);
  const setB = new Set(linesB);

  const onlyInFirst = linesA
    .map((text, idx) => ({ line: idx + 1, text }))
    .filter((item) => item.text.trim() && !setB.has(item.text))
    .slice(0, 40);

  const onlyInSecond = linesB
    .map((text, idx) => ({ line: idx + 1, text }))
    .filter((item) => item.text.trim() && !setA.has(item.text))
    .slice(0, 40);

  return {
    success: true,
    identical: first.content === second.content,
    firstFile: { path: first.path, size: first.size, lineCount: linesA.length },
    secondFile: { path: second.path, size: second.size, lineCount: linesB.length },
    onlyInFirstCount: onlyInFirst.length,
    onlyInSecondCount: onlyInSecond.length,
    onlyInFirstSample: onlyInFirst,
    onlyInSecondSample: onlyInSecond,
  };
}

export async function organizeMediaFiles(
  mounts: ComputerFolderMount[],
  folderPath = '',
  applyMove = false
): Promise<Record<string, unknown>> {
  const listing = await listComputerDirectory(mounts, folderPath, false, 1);
  const categories = {
    Photos: [] as ComputerEntryInfo[],
    Videos: [] as ComputerEntryInfo[],
    Audio: [] as ComputerEntryInfo[],
    Documents: [] as ComputerEntryInfo[],
    Other: [] as ComputerEntryInfo[],
  };

  for (const entry of listing.entries) {
    if (entry.kind !== 'file') continue;
    const ext = getFileExtension(entry.name);
    if (PHOTO_EXTS.has(ext)) categories.Photos.push(entry);
    else if (VIDEO_EXTS.has(ext)) categories.Videos.push(entry);
    else if (AUDIO_EXTS.has(ext)) categories.Audio.push(entry);
    else if (DOC_EXTS.has(ext)) categories.Documents.push(entry);
    else categories.Other.push(entry);
  }

  const moved: Array<{ from: string; to: string }> = [];
  if (applyMove) {
    const base = listing.path === '/' ? mounts[0]?.name ?? '' : listing.path;
    for (const cat of ['Photos', 'Videos', 'Audio', 'Documents'] as const) {
      for (const file of categories[cat]) {
        const dest = `${base}/Media/${cat}/${file.name}`;
        await moveOrRenameComputerEntry(mounts, file.path, dest);
        moved.push({ from: file.path, to: dest });
      }
    }
  }

  return {
    success: true,
    folderPath: listing.path,
    appliedMove: applyMove,
    counts: {
      photos: categories.Photos.length,
      videos: categories.Videos.length,
      audio: categories.Audio.length,
      documents: categories.Documents.length,
      other: categories.Other.length,
    },
    filesByCategory: {
      Photos: categories.Photos.map((f) => f.name),
      Videos: categories.Videos.map((f) => f.name),
      Audio: categories.Audio.map((f) => f.name),
      Documents: categories.Documents.map((f) => f.name),
    },
    movedCount: moved.length,
    movedSample: moved.slice(0, 30),
  };
}

export async function inspectGitRepository(
  mounts: ComputerFolderMount[],
  folderPath = ''
): Promise<Record<string, unknown>> {
  const target = resolveMountAndPath(mounts, folderPath);
  const baseDir = await getDirectoryAtSegments(
    target.mount.handle,
    target.subSegments,
    false
  );

  let gitDir: NativeDirectoryHandle;
  try {
    gitDir = (await baseDir.getDirectoryHandle('.git', {
      create: false,
    })) as NativeDirectoryHandle;
  } catch {
    return {
      success: false,
      isGitRepo: false,
      path: target.displayPath,
      note: 'No readable .git folder found here. (Note: Chromium may hide dot-folders or no git repo is initialized in this directory.)',
    };
  }

  const readGitText = async (segments: string[]): Promise<string | null> => {
    try {
      const dir = await getDirectoryAtSegments(gitDir, segments.slice(0, -1), false);
      const fileHandle = await dir.getFileHandle(segments[segments.length - 1], {
        create: false,
      });
      const file = await fileHandle.getFile();
      return await file.text();
    } catch {
      return null;
    }
  };

  const headRaw = (await readGitText(['HEAD']))?.trim() ?? null;
  const currentBranch = headRaw?.startsWith('ref: refs/heads/')
    ? headRaw.replace('ref: refs/heads/', '')
    : headRaw;
  const configRaw = await readGitText(['config']);
  const logsHeadRaw = await readGitText(['logs', 'HEAD']);

  const branches: string[] = [];
  try {
    const headsDir = await getDirectoryAtSegments(gitDir, ['refs', 'heads'], false);
    const items = await iterateDirectory(headsDir);
    for (const item of items) {
      if (item.kind === 'file') branches.push(item.name);
    }
  } catch {
    // ignore missing packed/loose refs
  }

  const recentCommits = (logsHeadRaw ?? '')
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-10)
    .reverse()
    .map((line) => {
      const tabIdx = line.indexOf('\t');
      const message = tabIdx !== -1 ? line.slice(tabIdx + 1) : line;
      const meta = tabIdx !== -1 ? line.slice(0, tabIdx) : '';
      const shaMatch = meta.match(/^[0-9a-f]+\s+([0-9a-f]{7,40})/);
      return {
        commit: shaMatch ? shaMatch[1].slice(0, 8) : '',
        message,
      };
    });

  return {
    success: true,
    isGitRepo: true,
    path: target.displayPath,
    currentBranch,
    branches,
    remotes: configRaw
      ? configRaw
          .split(/\r?\n/)
          .filter((l) => l.trim().startsWith('url ='))
          .map((l) => l.trim().replace('url =', '').trim())
      : [],
    recentCommits,
    note: 'Read-only .git metadata inspection in browser; executing git commit/push commands requires a local desktop terminal or Tauri shell.',
  };
}

export async function scaffoldSoftwareProject(
  mounts: ComputerFolderMount[],
  folderPath: string,
  projectName: string,
  template: string
): Promise<Record<string, unknown>> {
  const cleanName =
    projectName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-') || 'neuron-project';
  const base = folderPath.trim() ? `${folderPath.trim().replace(/\/+$/, '')}/${cleanName}` : cleanName;

  const files: Array<{ relPath: string; content: string }> = [];

  if (template === 'python-cli') {
    files.push(
      {
        relPath: 'README.md',
        content: `# ${cleanName}\n\nPython CLI starter created by Neuron Mind.\n\n\`\`\`bash\npython3 main.py --help\n\`\`\`\n`,
      },
      {
        relPath: 'requirements.txt',
        content: `# Add dependencies here\n`,
      },
      {
        relPath: 'main.py',
        content: `import argparse\n\ndef main() -> None:\n    parser = argparse.ArgumentParser(description="${cleanName} CLI")\n    parser.add_argument("--name", default="World")\n    args = parser.parse_args()\n    print(f"Hello, {args.name}!")\n\nif __name__ == "__main__":\n    main()\n`,
      }
    );
  } else if (template === 'static-web') {
    files.push(
      {
        relPath: 'index.html',
        content: `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${cleanName}</title>\n  <link rel="stylesheet" href="styles.css" />\n</head>\n<body>\n  <main class="container">\n    <h1>${cleanName}</h1>\n    <p>Starter site generated by Neuron Mind.</p>\n  </main>\n  <script src="app.js"></script>\n</body>\n</html>\n`,
      },
      {
        relPath: 'styles.css',
        content: `body { font-family: system-ui, sans-serif; margin: 2rem; color: #0b1b3b; background: #f8fafd; }\n.container { max-width: 720px; margin: 0 auto; }\n`,
      },
      {
        relPath: 'app.js',
        content: `console.log('${cleanName} initialized');\n`,
      }
    );
  } else {
    const isReact = template === 'react-vite-ts';
    files.push(
      {
        relPath: 'package.json',
        content: JSON.stringify(
          {
            name: cleanName,
            version: '0.1.0',
            private: true,
            type: 'module',
            scripts: isReact
              ? { dev: 'vite', build: 'vite build' }
              : { dev: 'npx tsx src/index.ts', build: 'tsc' },
          },
          null,
          2
        ),
      },
      {
        relPath: 'tsconfig.json',
        content: JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2022',
              module: 'ESNext',
              moduleResolution: 'Bundler',
              strict: true,
              skipLibCheck: true,
            },
          },
          null,
          2
        ),
      },
      {
        relPath: 'src/index.ts',
        content: `export function greet(name: string): string {\n  return \`Hello, \${name} from ${cleanName}\`;\n}\n\nconsole.log(greet('Neuron Mind'));\n`,
      },
      {
        relPath: 'README.md',
        content: `# ${cleanName}\n\nStarter template (${template}) generated by Neuron Mind.\nRun \`npm install\` and \`npm run dev\` inside a local terminal to start.\n`,
      }
    );
  }

  const createdPaths: string[] = [];
  for (const file of files) {
    const res = await writeComputerFile(
      mounts,
      `${base}/${file.relPath}`,
      file.content,
      'overwrite'
    );
    createdPaths.push(res.path);
  }

  return {
    success: true,
    projectName: cleanName,
    template,
    createdFiles: createdPaths,
    nextStepNote: 'Project files created on disk. Run package installation/build commands in your local terminal.',
  };
}

export async function executeComputerToolCall(
  mounts: ComputerFolderMount[],
  toolName: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  try {
    switch (toolName) {
      case 'list_computer_directory':
        return await listComputerDirectory(
          mounts,
          typeof args.folderPath === 'string' ? args.folderPath : '',
          Boolean(args.recursive),
          typeof args.maxDepth === 'number' ? args.maxDepth : 2
        );

      case 'read_computer_file':
        return await readComputerFile(mounts, String(args.filePath ?? ''));

      case 'write_computer_file':
        return await writeComputerFile(
          mounts,
          String(args.filePath ?? ''),
          String(args.content ?? ''),
          args.mode === 'append' ? 'append' : 'overwrite'
        );

      case 'create_computer_folder':
        return await createComputerFolder(mounts, String(args.folderPath ?? ''));

      case 'move_or_rename_computer_entry':
        return await moveOrRenameComputerEntry(
          mounts,
          String(args.sourcePath ?? ''),
          String(args.destinationPath ?? '')
        );

      case 'copy_computer_file':
        return await copyComputerFile(
          mounts,
          String(args.sourcePath ?? ''),
          String(args.destinationPath ?? '')
        );

      case 'delete_computer_entry':
        return await deleteComputerEntry(
          mounts,
          String(args.path ?? ''),
          Boolean(args.recursive)
        );

      case 'search_computer_files':
        return await searchComputerFiles(
          mounts,
          String(args.query ?? ''),
          typeof args.folderPath === 'string' ? args.folderPath : '',
          Boolean(args.searchContent)
        );

      case 'compare_computer_files':
        return await compareComputerFiles(
          mounts,
          String(args.firstFilePath ?? ''),
          String(args.secondFilePath ?? '')
        );

      case 'organize_media_files':
        return await organizeMediaFiles(
          mounts,
          typeof args.folderPath === 'string' ? args.folderPath : '',
          Boolean(args.applyMove)
        );

      case 'inspect_git_repository':
        return await inspectGitRepository(
          mounts,
          typeof args.folderPath === 'string' ? args.folderPath : ''
        );

      case 'scaffold_software_project':
        return await scaffoldSoftwareProject(
          mounts,
          typeof args.folderPath === 'string' ? args.folderPath : '',
          String(args.projectName ?? 'my-app'),
          String(args.template ?? 'node-ts')
        );

      default:
        return { success: false, error: `Unknown computer tool: ${toolName}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Computer file operation failed.',
    };
  }
}
