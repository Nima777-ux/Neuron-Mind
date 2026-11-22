import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { detectTextLanguage } from '../../i18n/detectLanguage';
import type {
  AgentModuleDescriptor,
  AppLanguage,
  AutomationRule,
  CalendarEvent,
  Conversation,
  DocumentFile,
  MemoryCategory,
  MemoryItem,
  SystemReadiness,
  TaskItem,
  TaskPriority,
  TaskStatus,
  WorkspaceMutation,
  WorkspaceSnapshot,
} from '../../types/assistant';
import { useAuth } from '../firebase/authContext';
import { OperationType, handleFirestoreError } from '../firebase/errorHandling';
import { db } from '../firebase/firebase';
import {
  loadWorkspaceCache,
  saveWorkspaceCache,
  type CachedWorkspaceState,
  type PendingMutation,
} from './storage';
import { mergeRemoteWithPending } from './syncMerge';
import { useOnlineStatus } from './useOnlineStatus';

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toIsoString(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && 'toDate' in val) {
    return (val as Timestamp).toDate().toISOString();
  }
  return new Date().toISOString();
}

function cleanOptional<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

export function useWorkspaceStore() {
  const { user, status: authStatus } = useAuth();
  const isOnline = useOnlineStatus();

  const [state, setState] = useState<CachedWorkspaceState>(() =>
    loadWorkspaceCache()
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  const updateState = useCallback(
    (updater: (prev: CachedWorkspaceState) => CachedWorkspaceState) => {
      setState((prev) => {
        const next = updater(prev);
        saveWorkspaceCache(next);
        return next;
      });
    },
    []
  );

  const executeSingleMutationOnFirestore = useCallback(
    async (uid: string, mutation: PendingMutation) => {
      switch (mutation.entity) {
        case 'task': {
          const path = `tasks/${mutation.payload.id}`;
          const ref = doc(db, 'tasks', mutation.payload.id);
          if (mutation.action === 'upsert') {
            const t = mutation.payload;
            const snap = await getDoc(ref).catch((err) =>
              handleFirestoreError(err, OperationType.GET, path)
            );
            if (!snap.exists()) {
              await setDoc(
                ref,
                cleanOptional({
                  id: t.id,
                  ownerId: uid,
                  title: t.title.slice(0, 300),
                  originalText: t.originalText?.slice(0, 1000),
                  sourceLanguage: t.sourceLanguage,
                  status: t.status,
                  priority: t.priority,
                  dueDate: t.dueDate?.slice(0, 40),
                  clientMutationId: mutation.mutationId,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                })
              ).catch((err) => handleFirestoreError(err, OperationType.CREATE, path));
            } else {
              await updateDoc(
                ref,
                cleanOptional({
                  title: t.title.slice(0, 300),
                  originalText: t.originalText?.slice(0, 1000),
                  priority: t.priority,
                  dueDate: t.dueDate?.slice(0, 40),
                  status: t.status,
                  clientMutationId: mutation.mutationId,
                  updatedAt: serverTimestamp(),
                })
              ).catch((err) => handleFirestoreError(err, OperationType.UPDATE, path));
            }
          } else if (mutation.action === 'update_status') {
            await updateDoc(ref, {
              status: mutation.payload.status,
              updatedAt: serverTimestamp(),
            }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, path));
          } else if (mutation.action === 'update_fields') {
            await updateDoc(
              ref,
              cleanOptional({
                title: mutation.payload.title.slice(0, 300),
                priority: mutation.payload.priority,
                dueDate: mutation.payload.dueDate?.slice(0, 40),
                status: mutation.payload.status,
                clientMutationId: mutation.mutationId,
                updatedAt: serverTimestamp(),
              })
            ).catch((err) => handleFirestoreError(err, OperationType.UPDATE, path));
          } else if (mutation.action === 'delete') {
            await deleteDoc(ref).catch((err) =>
              handleFirestoreError(err, OperationType.DELETE, path)
            );
          }
          break;
        }

        case 'event': {
          const path = `events/${mutation.payload.id}`;
          const ref = doc(db, 'events', mutation.payload.id);
          if (mutation.action === 'upsert') {
            const ev = mutation.payload;
            await setDoc(
              ref,
              cleanOptional({
                id: ev.id,
                ownerId: uid,
                title: ev.title.slice(0, 300),
                originalText: ev.originalText?.slice(0, 1000),
                sourceLanguage: ev.sourceLanguage,
                startTime: ev.startTime.slice(0, 40),
                endTime: ev.endTime?.slice(0, 40),
                location: ev.location?.slice(0, 200),
                clientMutationId: mutation.mutationId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              })
            ).catch((err) => handleFirestoreError(err, OperationType.CREATE, path));
          } else if (mutation.action === 'delete') {
            await deleteDoc(ref).catch((err) =>
              handleFirestoreError(err, OperationType.DELETE, path)
            );
          }
          break;
        }

        case 'document': {
          const path = `documents/${mutation.payload.id}`;
          const ref = doc(db, 'documents', mutation.payload.id);
          if (mutation.action === 'upsert') {
            const d = mutation.payload;
            const snap = await getDoc(ref).catch((err) =>
              handleFirestoreError(err, OperationType.GET, path)
            );
            if (!snap.exists()) {
              await setDoc(ref, {
                id: d.id,
                ownerId: uid,
                title: d.title.slice(0, 300),
                content: d.content.slice(0, 32000),
                folder: d.folder.slice(0, 120),
                sourceLanguage: d.sourceLanguage,
                cachedOffline: d.cachedOffline,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              }).catch((err) => handleFirestoreError(err, OperationType.CREATE, path));
            } else {
              await updateDoc(ref, {
                title: d.title.slice(0, 300),
                content: d.content.slice(0, 32000),
                folder: d.folder.slice(0, 120),
                cachedOffline: d.cachedOffline,
                updatedAt: serverTimestamp(),
              }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, path));
            }
          } else if (mutation.action === 'delete') {
            await deleteDoc(ref).catch((err) =>
              handleFirestoreError(err, OperationType.DELETE, path)
            );
          }
          break;
        }

        case 'memory': {
          const path = `memories/${mutation.payload.id}`;
          const ref = doc(db, 'memories', mutation.payload.id);
          if (mutation.action === 'upsert') {
            const m = mutation.payload;
            await setDoc(ref, {
              id: m.id,
              ownerId: uid,
              fact: m.fact.slice(0, 1000),
              category: m.category,
              sourceLanguage: m.sourceLanguage,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }).catch((err) => handleFirestoreError(err, OperationType.CREATE, path));
          } else if (mutation.action === 'delete') {
            await deleteDoc(ref).catch((err) =>
              handleFirestoreError(err, OperationType.DELETE, path)
            );
          }
          break;
        }

        case 'automation': {
          const path = `automations/${mutation.payload.id}`;
          const ref = doc(db, 'automations', mutation.payload.id);
          if (mutation.action === 'upsert') {
            const a = mutation.payload;
            await setDoc(ref, {
              id: a.id,
              ownerId: uid,
              name: a.name.slice(0, 200),
              trigger: a.trigger.slice(0, 200),
              actionSummary: a.actionSummary.slice(0, 500),
              enabled: a.enabled,
              sourceLanguage: a.sourceLanguage,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }).catch((err) => handleFirestoreError(err, OperationType.CREATE, path));
          } else if (mutation.action === 'toggle') {
            await updateDoc(ref, {
              enabled: mutation.payload.enabled,
              updatedAt: serverTimestamp(),
            }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, path));
          } else if (mutation.action === 'delete') {
            await deleteDoc(ref).catch((err) =>
              handleFirestoreError(err, OperationType.DELETE, path)
            );
          }
          break;
        }
      }
    },
    []
  );

  const syncPendingChanges = useCallback(async () => {
    if (!isOnline || authStatus !== 'authenticated' || !user) {
      return;
    }

    const queue = stateRef.current.pendingMutations;
    if (queue.length === 0 || isSyncing) {
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncNotice(null);

    const processedIds = new Set<string>();
    const remaining: PendingMutation[] = [];

    for (let i = 0; i < queue.length; i += 1) {
      const item = queue[i];
      if (processedIds.has(item.mutationId)) {
        continue;
      }
      try {
        await executeSingleMutationOnFirestore(user.uid, item);
        processedIds.add(item.mutationId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Synchronization failed.';
        setSyncError(message);
        remaining.push(...queue.slice(i));
        break;
      }
    }

    const now = new Date().toISOString();
    updateState((prev) => ({
      ...prev,
      pendingMutations: remaining,
      lastSyncedAt: remaining.length === 0 ? now : prev.lastSyncedAt,
    }));

    if (remaining.length === 0) {
      setSyncNotice('SYNC_OK');
    }
    setIsSyncing(false);
  }, [
    isOnline,
    authStatus,
    user,
    isSyncing,
    executeSingleMutationOnFirestore,
    updateState,
  ]);

  // Automatically drain pending mutations whenever connectivity or auth resumes
  useEffect(() => {
    if (isOnline && authStatus === 'authenticated' && user) {
      if (stateRef.current.pendingMutations.length > 0) {
        void syncPendingChanges();
      }
    }
  }, [isOnline, authStatus, user, syncPendingChanges]);

  // Real-time Firestore subscriptions when authenticated & online
  useEffect(() => {
    if (authStatus !== 'authenticated' || !user || !isOnline) {
      return;
    }

    const uid = user.uid;

    const unsubTasks = onSnapshot(
      query(collection(db, 'tasks'), where('ownerId', '==', uid)),
      (snap) => {
        const remoteTasks: TaskItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id ?? d.id),
            title: String(data.title ?? ''),
            originalText:
              typeof data.originalText === 'string' ? data.originalText : undefined,
            sourceLanguage: data.sourceLanguage === 'fa' ? 'fa' : 'en',
            status:
              data.status === 'completed' || data.status === 'in_progress'
                ? data.status
                : 'todo',
            priority:
              data.priority === 'low' || data.priority === 'high'
                ? data.priority
                : 'medium',
            dueDate: typeof data.dueDate === 'string' ? data.dueDate : undefined,
            createdAt: toIsoString(data.createdAt),
            updatedAt: toIsoString(data.updatedAt),
          };
        });
        remoteTasks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        updateState((prev) => {
          const merged = mergeRemoteWithPending(
            remoteTasks,
            prev.tasks,
            prev.pendingMutations,
            'task'
          );
          merged.items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          return {
            ...prev,
            tasks: merged.items,
            lastSyncedAt: new Date().toISOString(),
            conflictCount: prev.conflictCount + merged.conflictsResolved,
            lastConflictResolvedAt:
              merged.conflictsResolved > 0
                ? new Date().toISOString()
                : prev.lastConflictResolvedAt,
          };
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'tasks');
      }
    );

    const unsubEvents = onSnapshot(
      query(collection(db, 'events'), where('ownerId', '==', uid)),
      (snap) => {
        const remoteEvents: CalendarEvent[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id ?? d.id),
            title: String(data.title ?? ''),
            originalText:
              typeof data.originalText === 'string' ? data.originalText : undefined,
            sourceLanguage: data.sourceLanguage === 'fa' ? 'fa' : 'en',
            startTime: String(data.startTime ?? ''),
            endTime: typeof data.endTime === 'string' ? data.endTime : undefined,
            location: typeof data.location === 'string' ? data.location : undefined,
            createdAt: toIsoString(data.createdAt),
            updatedAt: toIsoString(data.updatedAt),
          };
        });
        remoteEvents.sort((a, b) => a.startTime.localeCompare(b.startTime));
        updateState((prev) => {
          const merged = mergeRemoteWithPending(
            remoteEvents,
            prev.events,
            prev.pendingMutations,
            'event'
          );
          merged.items.sort((a, b) => a.startTime.localeCompare(b.startTime));
          return {
            ...prev,
            events: merged.items,
            conflictCount: prev.conflictCount + merged.conflictsResolved,
            lastConflictResolvedAt:
              merged.conflictsResolved > 0
                ? new Date().toISOString()
                : prev.lastConflictResolvedAt,
          };
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'events');
      }
    );

    const unsubDocs = onSnapshot(
      query(collection(db, 'documents'), where('ownerId', '==', uid)),
      (snap) => {
        const remoteDocs: DocumentFile[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id ?? d.id),
            title: String(data.title ?? ''),
            content: String(data.content ?? ''),
            folder: String(data.folder ?? 'Notes'),
            sourceLanguage: data.sourceLanguage === 'fa' ? 'fa' : 'en',
            cachedOffline: Boolean(data.cachedOffline),
            createdAt: toIsoString(data.createdAt),
            updatedAt: toIsoString(data.updatedAt),
          };
        });
        remoteDocs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        updateState((prev) => {
          const merged = mergeRemoteWithPending(
            remoteDocs,
            prev.documents,
            prev.pendingMutations,
            'document'
          );
          merged.items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          return {
            ...prev,
            documents: merged.items,
            conflictCount: prev.conflictCount + merged.conflictsResolved,
            lastConflictResolvedAt:
              merged.conflictsResolved > 0
                ? new Date().toISOString()
                : prev.lastConflictResolvedAt,
          };
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'documents');
      }
    );

    const unsubMemories = onSnapshot(
      query(collection(db, 'memories'), where('ownerId', '==', uid)),
      (snap) => {
        const remoteMemories: MemoryItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id ?? d.id),
            fact: String(data.fact ?? ''),
            category:
              data.category === 'preference' || data.category === 'workflow'
                ? data.category
                : 'context',
            sourceLanguage: data.sourceLanguage === 'fa' ? 'fa' : 'en',
            createdAt: toIsoString(data.createdAt),
            updatedAt: toIsoString(data.updatedAt),
          };
        });
        remoteMemories.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        updateState((prev) => {
          const merged = mergeRemoteWithPending(
            remoteMemories,
            prev.memories,
            prev.pendingMutations,
            'memory'
          );
          merged.items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          return {
            ...prev,
            memories: merged.items,
            conflictCount: prev.conflictCount + merged.conflictsResolved,
            lastConflictResolvedAt:
              merged.conflictsResolved > 0
                ? new Date().toISOString()
                : prev.lastConflictResolvedAt,
          };
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'memories');
      }
    );

    const unsubAutomations = onSnapshot(
      query(collection(db, 'automations'), where('ownerId', '==', uid)),
      (snap) => {
        const remoteAutomations: AutomationRule[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id ?? d.id),
            name: String(data.name ?? ''),
            trigger: String(data.trigger ?? ''),
            actionSummary: String(data.actionSummary ?? ''),
            enabled: Boolean(data.enabled),
            sourceLanguage: data.sourceLanguage === 'fa' ? 'fa' : 'en',
            createdAt: toIsoString(data.createdAt),
            updatedAt: toIsoString(data.updatedAt),
          };
        });
        remoteAutomations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        updateState((prev) => {
          const merged = mergeRemoteWithPending(
            remoteAutomations,
            prev.automations,
            prev.pendingMutations,
            'automation'
          );
          merged.items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          return {
            ...prev,
            automations: merged.items,
            conflictCount: prev.conflictCount + merged.conflictsResolved,
            lastConflictResolvedAt:
              merged.conflictsResolved > 0
                ? new Date().toISOString()
                : prev.lastConflictResolvedAt,
          };
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'automations');
      }
    );

    return () => {
      unsubTasks();
      unsubEvents();
      unsubDocs();
      unsubMemories();
      unsubAutomations();
    };
  }, [authStatus, user, isOnline, updateState]);

  const queueOrRunMutation = useCallback(
    async (mutation: PendingMutation) => {
      if (isOnline && authStatus === 'authenticated' && user) {
        try {
          await executeSingleMutationOnFirestore(user.uid, mutation);
          updateState((prev) => ({
            ...prev,
            lastSyncedAt: new Date().toISOString(),
          }));
          return;
        } catch (error) {
          const msg =
            error instanceof Error ? error.message : 'Sync failed; queued locally.';
          setSyncError(msg);
        }
      }

      updateState((prev) => {
        const alreadyQueued = prev.pendingMutations.some(
          (m) => m.mutationId === mutation.mutationId
        );
        if (alreadyQueued) return prev;
        return {
          ...prev,
          pendingMutations: [...prev.pendingMutations, mutation],
        };
      });
    },
    [isOnline, authStatus, user, executeSingleMutationOnFirestore, updateState]
  );

  const createTask = useCallback(
    async (input: {
      title: string;
      priority: TaskPriority;
      dueDate?: string;
      sourceLanguage?: AppLanguage;
    }) => {
      const now = new Date().toISOString();
      const task: TaskItem = {
        id: makeId(),
        title: input.title.trim(),
        originalText: input.title.trim(),
        sourceLanguage: input.sourceLanguage ?? detectTextLanguage(input.title),
        status: 'todo',
        priority: input.priority,
        dueDate: input.dueDate?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };
      updateState((prev) => ({
        ...prev,
        tasks: [task, ...prev.tasks],
      }));
      await queueOrRunMutation({
        mutationId: makeId(),
        entity: 'task',
        action: 'upsert',
        payload: task,
        createdAt: now,
      });
      return task;
    },
    [queueOrRunMutation, updateState]
  );

  const updateTaskStatus = useCallback(
    async (id: string, status: TaskStatus) => {
      const now = new Date().toISOString();
      updateState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === id ? { ...t, status, updatedAt: now } : t
        ),
      }));
      await queueOrRunMutation({
        mutationId: makeId(),
        entity: 'task',
        action: 'update_status',
        payload: { id, status, updatedAt: now },
        createdAt: now,
      });
    },
    [queueOrRunMutation, updateState]
  );

  const updateTask = useCallback(
    async (
      id: string,
      input: {
        title: string;
        priority: TaskPriority;
        dueDate?: string;
      }
    ) => {
      const existing = stateRef.current.tasks.find((t) => t.id === id);
      if (!existing) return;
      const cleanTitle = input.title.trim();
      if (!cleanTitle) return;
      const cleanDue = input.dueDate?.trim() || undefined;
      const now = new Date().toISOString();
      updateState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                title: cleanTitle,
                priority: input.priority,
                dueDate: cleanDue,
                updatedAt: now,
              }
            : t
        ),
      }));
      await queueOrRunMutation({
        mutationId: makeId(),
        entity: 'task',
        action: 'update_fields',
        payload: {
          id,
          title: cleanTitle,
          priority: input.priority,
          dueDate: cleanDue,
          status: existing.status,
          updatedAt: now,
        },
        createdAt: now,
      });
    },
    [queueOrRunMutation, updateState]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      updateState((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== id),
      }));
      await queueOrRunMutation({
        mutationId: makeId(),
        entity: 'task',
        action: 'delete',
        payload: { id },
        createdAt: now,
      });
    },
    [queueOrRunMutation, updateState]
  );

  const createEvent = useCallback(
    async (input: {
      title: string;
      startTime: string;
      location?: string;
      sourceLanguage?: AppLanguage;
    }) => {
      const now = new Date().toISOString();
      const event: CalendarEvent = {
        id: makeId(),
        title: input.title.trim(),
        originalText: input.title.trim(),
        sourceLanguage: input.sourceLanguage ?? detectTextLanguage(input.title),
        startTime: input.startTime,
        location: input.location?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };
      updateState((prev) => ({
        ...prev,
        events: [event, ...prev.events].sort((a, b) =>
          a.startTime.localeCompare(b.startTime)
        ),
      }));
      await queueOrRunMutation({
        mutationId: makeId(),
        entity: 'event',
        action: 'upsert',
        payload: event,
        createdAt: now,
      });
      return event;
    },
    [queueOrRunMutation, updateState]
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      updateState((prev) => ({
        ...prev,
        events: prev.events.filter((e) => e.id !== id),
      }));
      await queueOrRunMutation({
        mutationId: makeId(),
        entity: 'event',
        action: 'delete',
        payload: { id },
        createdAt: now,
      });
    },
    [queueOrRunMutation, updateState]
  );

  const createDocument = useCallback(
    async (input: {
      title: string;
      content: string;
      folder: string;
      sourceLanguage?: AppLanguage;
    }) => {
      const now = new Date().toISOString();
      const docItem: DocumentFile = {
        id: makeId(),
        title: input.title.trim(),
        content: input.content,
        folder: input.folder.trim() || 'Notes',
        sourceLanguage:
          input.sourceLanguage ?? detectTextLanguage(input.title + ' ' + input.content),
        cachedOffline: true,
        createdAt: now,
        updatedAt: now,
      };
      updateState((prev) => ({
        ...prev,
        documents: [docItem, ...prev.documents],
      }));
      await queueOrRunMutation({
        mutationId: makeId(),
        entity: 'document',
        action: 'upsert',
        payload: docItem,
        createdAt: now,
      });
      return docItem;
    },
    [queueOrRunMutation, updateState]
  );

  const toggleDocumentOffline = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      const target = stateRef.current.documents.find((d) => d.id === id);
      if (!target) return;
      const updated: DocumentFile = {
        ...target,
        cachedOffline: !target.cachedOffline,
        updatedAt: now,
      };
      updateState((prev) => ({
        ...prev,
        documents: prev.documents.map((d) => (d.id === id ? updated : d)),
      }));
      await queueOrRunMutation({
        mutationId: makeId(),
        entity: 'document',
        action: 'upsert',
        payload: updated,
        createdAt: now,
      });
    },
    [queueOrRunMutation, updateState]
  );

  const deleteDocument = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      updateState((prev) => ({
        ...prev,
        documents: prev.documents.filter((d) => d.id !== id),
      }));
      await queueOrRunMutation({
        mutationId: makeId(),
        entity: 'document',
        action: 'delete',
        payload: { id },
        createdAt: now,
      });
    },
    [queueOrRunMutation, updateState]
  );

  const createMemory = useCallback(
    async (input: {
      fact: string;
      category: MemoryCategory;
      sourceLanguage?: AppLanguage;
    }) => {
      const now = new Date().toISOString();
      const mem: MemoryItem = {
        id: makeId(),
        fact: input.fact.trim(),
        category: input.category,
        sourceLanguage: input.sourceLanguage ?? detectTextLanguage(input.fact),
        createdAt: now,
        updatedAt: now,
      };
      updateState((prev) => ({
        ...prev,
        memories: [mem, ...prev.memories],
      }));
      await queueOrRunMutation({
        mutationId: makeId(),
        entity: 'memory',
        action: 'upsert',
        payload: mem,
        createdAt: now,
      });
      return mem;
    },
    [queueOrRunMutation, updateState]
  );

  const deleteMemory = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      updateState((prev) => ({
        ...prev,
        memories: prev.memories.filter((m) => m.id !== id),
      }));
      await queueOrRunMutation({
        mutationId: makeId(),
        entity: 'memory',
        action: 'delete',
        payload: { id },
        createdAt: now,
      });
    },
    [queueOrRunMutation, updateState]
  );

  const createAutomation = useCallback(
    async (input: {
      name: string;
      trigger: string;
      actionSummary: string;
      sourceLanguage?: AppLanguage;
    }) => {
      const now = new Date().toISOString();
      const rule: AutomationRule = {
        id: makeId(),
        name: input.name.trim(),
        trigger: input.trigger.trim(),
        actionSummary: input.actionSummary.trim(),
        enabled: true,
        sourceLanguage: input.sourceLanguage ?? detectTextLanguage(input.name),
        createdAt: now,
        updatedAt: now,
      };
      updateState((prev) => ({
        ...prev,
        automations: [rule, ...prev.automations],
      }));
      await queueOrRunMutation({
        mutationId: makeId(),
        entity: 'automation',
        action: 'upsert',
        payload: rule,
        createdAt: now,
      });
      return rule;
    },
    [queueOrRunMutation, updateState]
  );

  const toggleAutomation = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      const target = stateRef.current.automations.find((a) => a.id === id);
      if (!target) return;
      const enabled = !target.enabled;
      updateState((prev) => ({
        ...prev,
        automations: prev.automations.map((a) =>
          a.id === id ? { ...a, enabled, updatedAt: now } : a
        ),
      }));
      await queueOrRunMutation({
        mutationId: makeId(),
        entity: 'automation',
        action: 'toggle',
        payload: { id, enabled, updatedAt: now },
        createdAt: now,
      });
    },
    [queueOrRunMutation, updateState]
  );

  const deleteAutomation = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      updateState((prev) => ({
        ...prev,
        automations: prev.automations.filter((a) => a.id !== id),
      }));
      await queueOrRunMutation({
        mutationId: makeId(),
        entity: 'automation',
        action: 'delete',
        payload: { id },
        createdAt: now,
      });
    },
    [queueOrRunMutation, updateState]
  );

  const applyServerMutations = useCallback(
    async (mutations: WorkspaceMutation[]): Promise<WorkspaceMutation[]> => {
      const now = new Date().toISOString();
      const unhandled: WorkspaceMutation[] = [];
      for (const mut of mutations) {
        switch (mut.type) {
          case 'task_created':
            updateState((prev) => ({
              ...prev,
              tasks: [mut.item, ...prev.tasks.filter((t) => t.id !== mut.item.id)],
            }));
            await queueOrRunMutation({
              mutationId: makeId(),
              entity: 'task',
              action: 'upsert',
              payload: mut.item,
              createdAt: now,
            });
            break;
          case 'task_updated':
            updateState((prev) => ({
              ...prev,
              tasks: prev.tasks.map((t) => (t.id === mut.item.id ? mut.item : t)),
            }));
            await queueOrRunMutation({
              mutationId: makeId(),
              entity: 'task',
              action: 'update_status',
              payload: {
                id: mut.item.id,
                status: mut.item.status,
                updatedAt: mut.item.updatedAt,
              },
              createdAt: now,
            });
            break;
          case 'task_deleted':
            updateState((prev) => ({
              ...prev,
              tasks: prev.tasks.filter((t) => t.id !== mut.id),
            }));
            await queueOrRunMutation({
              mutationId: makeId(),
              entity: 'task',
              action: 'delete',
              payload: { id: mut.id },
              createdAt: now,
            });
            break;
          case 'event_created':
            updateState((prev) => ({
              ...prev,
              events: [mut.item, ...prev.events].sort((a, b) =>
                a.startTime.localeCompare(b.startTime)
              ),
            }));
            await queueOrRunMutation({
              mutationId: makeId(),
              entity: 'event',
              action: 'upsert',
              payload: mut.item,
              createdAt: now,
            });
            break;
          case 'document_created':
            updateState((prev) => ({
              ...prev,
              documents: [mut.item, ...prev.documents],
            }));
            await queueOrRunMutation({
              mutationId: makeId(),
              entity: 'document',
              action: 'upsert',
              payload: mut.item,
              createdAt: now,
            });
            break;
          case 'memory_created':
            updateState((prev) => ({
              ...prev,
              memories: [mut.item, ...prev.memories],
            }));
            await queueOrRunMutation({
              mutationId: makeId(),
              entity: 'memory',
              action: 'upsert',
              payload: mut.item,
              createdAt: now,
            });
            break;
          case 'automation_created':
            updateState((prev) => ({
              ...prev,
              automations: [mut.item, ...prev.automations],
            }));
            await queueOrRunMutation({
              mutationId: makeId(),
              entity: 'automation',
              action: 'upsert',
              payload: mut.item,
              createdAt: now,
            });
            break;
          default:
            unhandled.push(mut);
            break;
        }
      }
      return unhandled;
    },
    [queueOrRunMutation, updateState]
  );

  const setCachedOverview = useCallback(
    (readiness: SystemReadiness, modules: AgentModuleDescriptor[]) => {
      updateState((prev) => ({
        ...prev,
        readiness,
        modules,
      }));
    },
    [updateState]
  );

  const setCachedConversations = useCallback(
    (conversations: Conversation[]) => {
      updateState((prev) => ({
        ...prev,
        conversations,
      }));
    },
    [updateState]
  );

  const getWorkspaceSnapshot = useCallback((): WorkspaceSnapshot => {
    const cur = stateRef.current;
    return {
      tasks: cur.tasks,
      events: cur.events,
      documents: cur.documents,
      memories: cur.memories,
      automations: cur.automations,
    };
  }, []);

  return {
    isOnline,
    isSyncing,
    syncError,
    syncNotice,
    clearSyncMessages: () => {
      setSyncError(null);
      setSyncNotice(null);
    },
    tasks: state.tasks,
    events: state.events,
    documents: state.documents,
    memories: state.memories,
    automations: state.automations,
    conversations: state.conversations,
    readiness: state.readiness,
    modules: state.modules,
    pendingCount: state.pendingMutations.length,
    lastSyncedAt: state.lastSyncedAt,
    conflictCount: state.conflictCount,
    lastConflictResolvedAt: state.lastConflictResolvedAt,
    syncPendingChanges,
    createTask,
    updateTaskStatus,
    updateTask,
    deleteTask,
    createEvent,
    deleteEvent,
    createDocument,
    toggleDocumentOffline,
    deleteDocument,
    createMemory,
    deleteMemory,
    createAutomation,
    toggleAutomation,
    deleteAutomation,
    applyServerMutations,
    setCachedOverview,
    setCachedConversations,
    getWorkspaceSnapshot,
  };
}
