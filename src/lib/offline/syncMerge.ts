import type { PendingMutation } from './storage';

export interface SyncEntityBase {
  id: string;
  updatedAt: string;
}

export interface MergeResult<T extends SyncEntityBase> {
  items: T[];
  conflictsResolved: number;
}

/**
 * Merges incoming remote Firestore snapshots with local cached items while
 * respecting un-flushed offline mutations in the local queue.
 * - Pending deletions suppress remote items until deletion flushes.
 * - Pending local edits/creates take precedence over older remote snapshots
 *   and increment `conflictsResolved` when the remote state diverged.
 */
export function mergeRemoteWithPending<T extends SyncEntityBase>(
  remoteItems: T[],
  localItems: T[],
  pendingMutations: PendingMutation[],
  entity: PendingMutation['entity']
): MergeResult<T> {
  const relevant = pendingMutations.filter((m) => m.entity === entity);
  if (relevant.length === 0) {
    return { items: remoteItems, conflictsResolved: 0 };
  }

  const pendingDeleteIds = new Set<string>();
  const pendingUpsertIds = new Set<string>();

  for (const mut of relevant) {
    const id = mut.payload.id;
    if (mut.action === 'delete') {
      pendingDeleteIds.add(id);
      pendingUpsertIds.delete(id);
    } else {
      pendingDeleteIds.delete(id);
      pendingUpsertIds.add(id);
    }
  }

  const localById = new Map(localItems.map((item) => [item.id, item]));
  const mergedById = new Map<string, T>();
  let conflictsResolved = 0;

  for (const remote of remoteItems) {
    if (pendingDeleteIds.has(remote.id)) {
      conflictsResolved += 1;
      continue;
    }
    if (pendingUpsertIds.has(remote.id)) {
      const localVersion = localById.get(remote.id);
      if (localVersion) {
        if (remote.updatedAt !== localVersion.updatedAt) {
          conflictsResolved += 1;
        }
        mergedById.set(remote.id, localVersion);
        continue;
      }
    }
    mergedById.set(remote.id, remote);
  }

  for (const id of pendingUpsertIds) {
    if (!mergedById.has(id)) {
      const localVersion = localById.get(id);
      if (localVersion) {
        mergedById.set(id, localVersion);
      }
    }
  }

  return {
    items: Array.from(mergedById.values()),
    conflictsResolved,
  };
}
