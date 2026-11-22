import { useCallback, useEffect, useRef, useState } from 'react';
import {
  countTopLevelEntries,
  executeComputerToolCall,
  isDirectoryPickerSupported,
  isTopLevelWindowContext,
  loadStoredFolderMounts,
  pickComputerFolder,
  queryMountPermission,
  removeStoredFolderMount,
  requestMountPermission,
  type ComputerFolderMount,
} from '../lib/platform/computerFiles';
import type {
  ClientToolCall,
  ClientToolResult,
  ComputerFsContext,
} from '../types/assistant';

export interface DeleteConfirmationRequest {
  paths: string[];
}

export function useComputerFiles() {
  const [mounts, setMounts] = useState<ComputerFolderMount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mountError, setMountError] = useState<string | null>(null);
  const mountsRef = useRef<ComputerFolderMount[]>(mounts);
  mountsRef.current = mounts;

  const isSupported = isDirectoryPickerSupported();
  const isTopLevel = isTopLevelWindowContext();

  const refreshMounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const stored = await loadStoredFolderMounts();
      const hydrated = await Promise.all(
        stored.map(async (item): Promise<ComputerFolderMount> => {
          const permission = await queryMountPermission(item.handle);
          const entryCount = await countTopLevelEntries(item.handle, permission);
          return {
            id: item.id,
            name: item.name,
            handle: item.handle,
            addedAt: item.addedAt,
            permission,
            entryCount,
          };
        })
      );
      setMounts(hydrated);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshMounts();
  }, [refreshMounts]);

  const connectFolder = useCallback(async (): Promise<ComputerFolderMount | null> => {
    setMountError(null);
    try {
      await pickComputerFolder();
      await refreshMounts();
      return mountsRef.current[0] ?? null;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'PICKER_CANCELLED') {
          return null;
        }
        setMountError(error.message);
      } else {
        setMountError('FOLDER_CONNECT_FAILED');
      }
      return null;
    }
  }, [refreshMounts]);

  const reauthorizeMount = useCallback(
    async (id: string) => {
      setMountError(null);
      const target = mountsRef.current.find((m) => m.id === id);
      if (!target) return;
      const perm = await requestMountPermission(target.handle);
      if (perm !== 'granted') {
        setMountError('PERMISSION_DENIED');
      }
      await refreshMounts();
    },
    [refreshMounts]
  );

  const disconnectMount = useCallback(
    async (id: string) => {
      setMountError(null);
      await removeStoredFolderMount(id);
      await refreshMounts();
    },
    [refreshMounts]
  );

  const getComputerFsContext = useCallback((): ComputerFsContext => {
    const current = mountsRef.current;
    const granted = current.filter((m) => m.permission === 'granted');
    return {
      supported: isSupported,
      connected: granted.length > 0,
      canWrite: granted.length > 0,
      mounts: current.map((m) => ({
        id: m.id,
        name: m.name,
        permission: m.permission,
        entryCount: m.entryCount,
      })),
    };
  }, [isSupported]);

  const executeClientToolCalls = useCallback(
    async (
      calls: ClientToolCall[],
      confirmDeletePaths: (paths: string[]) => Promise<boolean>
    ): Promise<ClientToolResult[]> => {
      const deleteCalls = calls.filter((c) => c.name === 'delete_computer_entry');
      let deleteApproved = true;

      if (deleteCalls.length > 0) {
        const paths = deleteCalls.map((c) => String(c.args?.path ?? ''));
        deleteApproved = await confirmDeletePaths(paths);
      }

      const results: ClientToolResult[] = [];
      for (const call of calls) {
        if (call.name === 'delete_computer_entry' && !deleteApproved) {
          results.push({
            id: call.id,
            name: call.name,
            response: {
              success: false,
              cancelledByUser: true,
              message: 'User cancelled deletion of the computer file or folder.',
            },
          });
          continue;
        }

        const res = await executeComputerToolCall(
          mountsRef.current,
          call.name,
          call.args ?? {}
        );
        results.push({
          id: call.id,
          name: call.name,
          response: res,
        });
      }

      await refreshMounts();
      return results;
    },
    [refreshMounts]
  );

  return {
    mounts,
    isSupported,
    isTopLevel,
    isLoading,
    mountError,
    clearMountError: () => setMountError(null),
    connectFolder,
    reauthorizeMount,
    disconnectMount,
    refreshMounts,
    getComputerFsContext,
    executeClientToolCalls,
  };
}
