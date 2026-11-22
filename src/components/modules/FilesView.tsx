import {
  ArrowRight,
  ChevronLeft,
  ClipboardCopy,
  Copy,
  Download,
  FileArchive,
  FileText,
  FileUp,
  Folder,
  FolderPlus,
  HardDrive,
  Image,
  Pencil,
  Pin,
  RefreshCw,
  Search,
  Trash2,
  Unlink,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useLanguage } from '../../i18n/languageContext';
import { exportTextDocument, importTextDocument } from '../../lib/platform';
import {
  createComputerFolder,
  deleteComputerEntry,
  listComputerDirectory,
  moveOrRenameComputerEntry,
  organizeMediaFiles,
  readComputerFile,
  searchComputerFiles,
  writeComputerFile,
  type ComputerEntryInfo,
  type ComputerFolderMount,
} from '../../lib/platform/computerFiles';
import type { ClipboardEntry, DocumentFile, WorkspaceSnapshot } from '../../types/assistant';

interface FilesViewProps {
  documents: DocumentFile[];
  onCreateDocument: (input: {
    title: string;
    content: string;
    folder: string;
  }) => Promise<unknown>;
  onToggleOffline: (id: string) => Promise<void>;
  onDeleteDocument: (id: string) => Promise<void>;
  onDraftInAssistant: (prompt: string) => void;
  computerMounts: ComputerFolderMount[];
  computerFsSupported: boolean;
  computerMountError: string | null;
  onClearMountError: () => void;
  onConnectFolder: () => Promise<unknown>;
  onReauthorizeFolder: (id: string) => Promise<void>;
  onDisconnectFolder: (id: string) => Promise<void>;
  onRefreshMounts: () => Promise<void>;
  workspaceSnapshot: WorkspaceSnapshot;
  onCreateVerifiedBackup: (
    snapshot: WorkspaceSnapshot,
    mounts: ComputerFolderMount[],
    targetSubfolder?: string,
    format?: 'json' | 'zip'
  ) => Promise<{ filename: string; savedToPcPath?: string; checksumHex: string }>;
  onRestoreBackupSnapshot: (data: Partial<WorkspaceSnapshot>) => Promise<number>;
  clipboardHistory: ClipboardEntry[];
  onSaveClipboardEntry: (text: string, label?: string) => unknown;
  onTogglePinClipboard: (id: string) => void;
  onDeleteClipboardEntry: (id: string) => void;
}

type FilesSubTab = 'explorer' | 'media' | 'backups' | 'clipboard';

function formatFileSize(bytes?: number): string {
  if (bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesView({
  documents,
  onCreateDocument,
  onToggleOffline,
  onDeleteDocument,
  onDraftInAssistant,
  computerMounts,
  computerFsSupported,
  computerMountError,
  onClearMountError,
  onConnectFolder,
  onReauthorizeFolder,
  onDisconnectFolder,
  onRefreshMounts,
  workspaceSnapshot,
  onCreateVerifiedBackup,
  onRestoreBackupSnapshot,
  clipboardHistory,
  onSaveClipboardEntry,
  onTogglePinClipboard,
  onDeleteClipboardEntry,
}: FilesViewProps) {
  const { t, formatDateTime, formatNumber } = useLanguage();
  const [filesTab, setFilesTab] = useState<FilesSubTab>('explorer');

  // Media Organizer state
  const [mediaReport, setMediaReport] = useState<Record<string, unknown> | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Backups & Restore state
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  // Clipboard state
  const [clipText, setClipText] = useState('');
  const [clipLabel, setClipLabel] = useState('');
  const [clipSearch, setClipSearch] = useState('');
  const [clipNotice, setClipNotice] = useState<string | null>(null);

  // Workspace offline documents state
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState('Notes');
  const [content, setContent] = useState('');
  const [search, setSearch] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);

  // Computer folder browser state
  const grantedMounts = useMemo(
    () => computerMounts.filter((m) => m.permission === 'granted'),
    [computerMounts]
  );
  const [currentFolderPath, setCurrentFolderPath] = useState<string>('');
  const [pcEntries, setPcEntries] = useState<ComputerEntryInfo[]>([]);
  const [pcSearchQuery, setPcSearchQuery] = useState('');
  const [pcBusy, setPcBusy] = useState(false);
  const [pcError, setPcError] = useState<string | null>(null);
  const [newSubfolderName, setNewSubfolderName] = useState('');
  const [newPcFileName, setNewPcFileName] = useState('');
  const [newPcFileContent, setNewPcFileContent] = useState('');
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<ComputerEntryInfo | null>(null);
  const [editorFile, setEditorFile] = useState<{
    path: string;
    name: string;
    content: string;
  } | null>(null);

  const loadPcDirectory = useCallback(
    async (targetPath: string, queryText = '') => {
      if (grantedMounts.length === 0) {
        setPcEntries([]);
        return;
      }
      setPcBusy(true);
      setPcError(null);
      try {
        if (queryText.trim()) {
          const searchRes = await searchComputerFiles(
            computerMounts,
            queryText.trim(),
            targetPath,
            false
          );
          setPcEntries(searchRes.matches);
        } else {
          const listRes = await listComputerDirectory(
            computerMounts,
            targetPath,
            false,
            1
          );
          setPcEntries(listRes.entries);
        }
      } catch (err) {
        setPcError(err instanceof Error ? err.message : t.files.fileActionError);
      } finally {
        setPcBusy(false);
      }
    },
    [computerMounts, grantedMounts.length, t.files.fileActionError]
  );

  useEffect(() => {
    if (grantedMounts.length > 0) {
      const initialPath =
        currentFolderPath || (grantedMounts.length === 1 ? grantedMounts[0].name : '');
      if (!currentFolderPath && grantedMounts.length === 1) {
        setCurrentFolderPath(initialPath);
      }
      void loadPcDirectory(initialPath, pcSearchQuery);
    } else {
      setPcEntries([]);
    }
  }, [grantedMounts, currentFolderPath, pcSearchQuery, loadPcDirectory]);

  const handleCreateSubfolder = async (e: FormEvent) => {
    e.preventDefault();
    const clean = newSubfolderName.trim();
    if (!clean) return;
    setPcError(null);
    try {
      const base = currentFolderPath || grantedMounts[0]?.name || '';
      const fullPath = base ? `${base}/${clean}` : clean;
      await createComputerFolder(computerMounts, fullPath);
      setNewSubfolderName('');
      await onRefreshMounts();
      await loadPcDirectory(currentFolderPath, pcSearchQuery);
    } catch (err) {
      setPcError(err instanceof Error ? err.message : t.files.fileActionError);
    }
  };

  const handleCreatePcFile = async (e: FormEvent) => {
    e.preventDefault();
    const clean = newPcFileName.trim();
    if (!clean) return;
    setPcError(null);
    try {
      const base = currentFolderPath || grantedMounts[0]?.name || '';
      const fullPath = base ? `${base}/${clean}` : clean;
      await writeComputerFile(computerMounts, fullPath, newPcFileContent, 'overwrite');
      setNewPcFileName('');
      setNewPcFileContent('');
      await onRefreshMounts();
      await loadPcDirectory(currentFolderPath, pcSearchQuery);
    } catch (err) {
      setPcError(err instanceof Error ? err.message : t.files.fileActionError);
    }
  };

  const handleOpenFileEditor = async (entry: ComputerEntryInfo) => {
    setPcError(null);
    try {
      const res = await readComputerFile(computerMounts, entry.path);
      setEditorFile({
        path: res.path,
        name: res.name,
        content: res.content,
      });
    } catch (err) {
      setPcError(err instanceof Error ? err.message : t.files.fileActionError);
    }
  };

  const handleSaveEditorFile = async () => {
    if (!editorFile) return;
    setPcError(null);
    try {
      await writeComputerFile(
        computerMounts,
        editorFile.path,
        editorFile.content,
        'overwrite'
      );
      setEditorFile(null);
      await loadPcDirectory(currentFolderPath, pcSearchQuery);
    } catch (err) {
      setPcError(err instanceof Error ? err.message : t.files.fileActionError);
    }
  };

  const handleConfirmRename = async (entry: ComputerEntryInfo) => {
    const clean = renameValue.trim();
    if (!clean || clean === entry.name) {
      setRenamingPath(null);
      return;
    }
    setPcError(null);
    try {
      const parent = entry.path.includes('/')
        ? entry.path.slice(0, entry.path.lastIndexOf('/'))
        : '';
      const destPath = parent ? `${parent}/${clean}` : clean;
      await moveOrRenameComputerEntry(computerMounts, entry.path, destPath);
      setRenamingPath(null);
      await onRefreshMounts();
      await loadPcDirectory(currentFolderPath, pcSearchQuery);
    } catch (err) {
      setPcError(err instanceof Error ? err.message : t.files.fileActionError);
    }
  };

  const handleConfirmDeletePcEntry = async () => {
    if (!pendingDeleteEntry) return;
    setPcError(null);
    try {
      await deleteComputerEntry(
        computerMounts,
        pendingDeleteEntry.path,
        pendingDeleteEntry.kind === 'directory'
      );
      setPendingDeleteEntry(null);
      await onRefreshMounts();
      await loadPcDirectory(currentFolderPath, pcSearchQuery);
    } catch (err) {
      setPcError(err instanceof Error ? err.message : t.files.fileActionError);
    }
  };

  const handleNavigateUp = () => {
    if (!currentFolderPath) return;
    const idx = currentFolderPath.lastIndexOf('/');
    if (idx === -1) {
      setCurrentFolderPath(grantedMounts.length > 1 ? '' : currentFolderPath);
    } else {
      setCurrentFolderPath(currentFolderPath.slice(0, idx));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onCreateDocument({
      title: title.trim(),
      folder: folder.trim() || 'Notes',
      content,
    });
    setTitle('');
    setContent('');
  };

  const handleImportFile = async () => {
    setFileError(null);
    try {
      const imported = await importTextDocument();
      if (!imported) return;
      await onCreateDocument({
        title: imported.title,
        content: imported.content,
        folder: t.files.importedFolderLabel,
      });
    } catch {
      setFileError(t.files.fileActionError);
    }
  };

  const handleExportFile = async (docItem: DocumentFile) => {
    setFileError(null);
    try {
      await exportTextDocument(docItem.title, docItem.content);
    } catch {
      setFileError(t.files.fileActionError);
    }
  };

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (doc) =>
        doc.title.toLowerCase().includes(q) ||
        doc.content.toLowerCase().includes(q) ||
        doc.folder.toLowerCase().includes(q)
    );
  }, [documents, search]);

  const resolvedMountError =
    computerMountError === 'IFRAME_BLOCKED'
      ? t.files.iframeBlockedNote
      : computerMountError === 'FOLDER_PICKER_UNSUPPORTED'
        ? t.files.unsupportedFolderPickerNote
        : computerMountError;

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFD] dark:bg-[#071126] px-4 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#1E3A8A]/80 dark:text-blue-300/80">{t.files.kicker}</p>
            <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight text-[#0B1B3B] dark:text-slate-100">
              {t.files.title}
            </h2>
            <p className="text-sm lg:text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              {t.files.subtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleImportFile()}
              className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-[#102A5C] dark:text-blue-200 bg-white dark:bg-[#0D1B36] border border-blue-900/15 dark:border-blue-400/20 hover:bg-[#EEF3FA] dark:hover:bg-[#132852] rounded-lg transition-colors whitespace-nowrap"
            >
              <FileUp className="h-4 w-4" aria-hidden="true" />
              <span>{t.files.importFile}</span>
            </button>
            <button
              type="button"
              onClick={() => onDraftInAssistant(t.files.askAssistantPrompt)}
              className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap"
            >
              <span>{t.files.askAssistant}</span>
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </button>
          </div>
        </section>

        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#EAF0FA] dark:bg-[#132852] border border-blue-900/10 dark:border-blue-400/20">
          {(
            [
              ['explorer', t.extras.tabFilesExplorer],
              ['media', t.extras.tabMediaOrganizer],
              ['backups', t.extras.tabBackups],
              ['clipboard', t.extras.tabClipboard],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilesTab(id)}
              className={`min-h-[36px] px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filesTab === id
                  ? 'bg-white dark:bg-[#0D1B36] text-[#0B1B3B] dark:text-slate-100 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-[#0B1B3B] dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {filesTab === 'explorer' ? (
          <>
        {/* Connected Computer Folders & Local Disk Explorer */}
        <section className="p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h3 className="font-display text-lg font-semibold text-[#0B1B3B] dark:text-slate-100">
                {t.files.computerSectionTitle}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {t.files.computerSectionDesc}
              </p>
            </div>
            {computerFsSupported ? (
              <button
                type="button"
                onClick={() => void onConnectFolder()}
                className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <FolderPlus className="h-4 w-4" aria-hidden="true" />
                <span>{t.files.connectComputerFolder}</span>
              </button>
            ) : null}
          </div>

          {!computerFsSupported ? (
            <div className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-500/35 bg-amber-50 dark:bg-amber-950/45 text-xs text-amber-900 dark:text-amber-200">
              {t.files.unsupportedFolderPickerNote}
            </div>
          ) : null}

          {resolvedMountError ? (
            <div className="p-3.5 rounded-lg border border-red-200 dark:border-red-500/35 bg-red-50 dark:bg-red-950/45 flex items-start justify-between gap-3 text-xs text-red-800 dark:text-red-200">
              <span>{resolvedMountError}</span>
              <button
                type="button"
                onClick={onClearMountError}
                className="font-medium underline shrink-0"
              >
                {t.chat.dismiss}
              </button>
            </div>
          ) : null}

          {pcError ? (
            <div className="p-3 rounded-lg border border-red-200 dark:border-red-500/35 bg-red-50 dark:bg-red-950/45 flex items-center justify-between gap-3 text-xs text-red-800 dark:text-red-200">
              <span>{pcError}</span>
              <button
                type="button"
                onClick={() => setPcError(null)}
                className="font-medium underline shrink-0"
              >
                {t.chat.dismiss}
              </button>
            </div>
          ) : null}

          {computerMounts.length === 0 ? (
            <div className="p-6 rounded-lg border border-blue-900/10 dark:border-blue-400/20 bg-[#F8FAFD] dark:bg-[#09142B] text-center text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              {t.files.noComputerFolders}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="divide-y divide-blue-950/10 dark:divide-blue-400/15 border border-blue-900/15 dark:border-blue-400/20 rounded-lg">
                {computerMounts.map((mount) => {
                  const granted = mount.permission === 'granted';
                  return (
                    <div
                      key={mount.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Folder
                          className="h-5 w-5 text-[#102A5C] dark:text-blue-300 shrink-0"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100 truncate">
                            {mount.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span
                              className={
                                granted
                                  ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                                  : 'text-amber-700 dark:text-amber-300 font-medium'
                              }
                            >
                              {granted
                                ? t.files.folderPermissionGranted
                                : t.files.folderPermissionPrompt}
                            </span>
                            {granted ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  {formatNumber(mount.entryCount)} {t.files.itemsLabel}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {granted ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentFolderPath(mount.name);
                                setPcSearchQuery('');
                              }}
                              className="min-h-[34px] px-3 py-1 text-xs font-medium rounded-md border border-blue-900/15 dark:border-blue-400/20 bg-[#F8FAFD] dark:bg-[#132852] hover:bg-[#EAF0FA] dark:hover:bg-[#1A3568] text-[#102A5C] dark:text-blue-200"
                            >
                              {t.files.openFolderAction}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onDraftInAssistant(
                                  `${t.files.askAgentFolderPromptPrefix} "${mount.name}"`
                                )
                              }
                              className="min-h-[34px] px-3 py-1 text-xs font-medium rounded-md bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 text-white"
                            >
                              {t.files.askAgentFolder}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void onReauthorizeFolder(mount.id)}
                            className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white"
                          >
                            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{t.files.reconnectFolder}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void onDisconnectFolder(mount.id)}
                          aria-label={t.files.disconnectFolder}
                          className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#132852]"
                        >
                          <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{t.files.disconnectFolder}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {grantedMounts.length > 0 ? (
                <div className="space-y-3 pt-2 border-t border-blue-950/10 dark:border-blue-400/15">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={handleNavigateUp}
                        disabled={!currentFolderPath}
                        className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-[#102A5C] dark:text-blue-200 hover:bg-[#EEF3FA] dark:hover:bg-[#132852] disabled:opacity-40"
                      >
                        <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                        <span>{t.files.upOneLevel}</span>
                      </button>
                      <span className="font-mono text-xs text-slate-700 dark:text-slate-200 truncate">
                        {currentFolderPath || t.files.rootLevel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search
                          className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 absolute top-1/2 -translate-y-1/2 start-2.5 pointer-events-none"
                          aria-hidden="true"
                        />
                        <input
                          type="search"
                          dir="auto"
                          value={pcSearchQuery}
                          onChange={(e) => setPcSearchQuery(e.target.value)}
                          placeholder={t.files.searchPcPlaceholder}
                          className="min-h-[34px] w-48 sm:w-56 ps-8 pe-2.5 py-1 text-xs rounded-md border border-blue-900/15 dark:border-blue-400/20 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void loadPcDirectory(currentFolderPath, pcSearchQuery)
                        }
                        aria-label={t.files.refreshFolder}
                        className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-md border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-[#102A5C] dark:text-blue-200 hover:bg-[#EEF3FA] dark:hover:bg-[#132852]"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${pcBusy ? 'animate-spin' : ''}`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </div>

                  {/* Quick Folder & File Creators */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <form
                      onSubmit={(e) => void handleCreateSubfolder(e)}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        dir="auto"
                        value={newSubfolderName}
                        onChange={(e) => setNewSubfolderName(e.target.value)}
                        placeholder={t.files.newSubfolderPlaceholder}
                        className="flex-1 min-h-[38px] px-3 py-1.5 text-xs rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!newSubfolderName.trim()}
                        className="min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-white dark:bg-[#132852] text-[#102A5C] dark:text-blue-200 hover:bg-[#EAF0FA] dark:hover:bg-[#1A3568] disabled:opacity-40 whitespace-nowrap"
                      >
                        {t.files.createSubfolderButton}
                      </button>
                    </form>

                    <form
                      onSubmit={(e) => void handleCreatePcFile(e)}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        dir="auto"
                        value={newPcFileName}
                        onChange={(e) => setNewPcFileName(e.target.value)}
                        placeholder={t.files.newPcFilePlaceholder}
                        className="flex-1 min-h-[38px] px-3 py-1.5 text-xs rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!newPcFileName.trim()}
                        className="min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg bg-[#102A5C] dark:bg-blue-600 text-white hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:opacity-40 whitespace-nowrap"
                      >
                        {t.files.createPcFileButton}
                      </button>
                    </form>
                  </div>

                  {newPcFileName.trim() ? (
                    <textarea
                      rows={2}
                      dir="auto"
                      value={newPcFileContent}
                      onChange={(e) => setNewPcFileContent(e.target.value)}
                      placeholder={t.files.newPcFileContentPlaceholder}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                    />
                  ) : null}

                  {/* Directory Table */}
                  {pcEntries.length === 0 ? (
                    <p className="py-5 text-center text-xs text-slate-500 dark:text-slate-400">
                      {t.files.emptyFolderNotice}
                    </p>
                  ) : (
                    <div className="border border-blue-900/15 dark:border-blue-400/20 rounded-lg divide-y divide-blue-950/10 dark:divide-blue-400/15 max-h-80 overflow-y-auto">
                      {pcEntries.map((entry) => {
                        const isDir = entry.kind === 'directory';
                        const isRenaming = renamingPath === entry.path;
                        return (
                          <div
                            key={entry.path}
                            className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-[#F8FAFD] dark:hover:bg-[#132852]/60 text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {isDir ? (
                                <Folder
                                  className="h-4 w-4 text-[#102A5C] dark:text-blue-300 shrink-0"
                                  aria-hidden="true"
                                />
                              ) : (
                                <FileText
                                  className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0"
                                  aria-hidden="true"
                                />
                              )}

                              {isRenaming ? (
                                <div className="flex items-center gap-1.5 flex-1">
                                  <input
                                    type="text"
                                    dir="auto"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    placeholder={t.files.renamePlaceholder}
                                    className="flex-1 min-h-[30px] px-2 py-1 text-xs rounded border border-[#102A5C] dark:border-blue-400 bg-white dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => void handleConfirmRename(entry)}
                                    className="px-2.5 py-1 rounded bg-[#102A5C] dark:bg-blue-600 text-white font-medium"
                                  >
                                    {t.files.saveRename}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRenamingPath(null)}
                                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    isDir
                                      ? setCurrentFolderPath(entry.path)
                                      : void handleOpenFileEditor(entry)
                                  }
                                  className="text-start min-w-0 flex-1 hover:underline"
                                >
                                  <p
                                    dir="auto"
                                    className="font-medium text-[#0B1B3B] dark:text-slate-100 truncate"
                                  >
                                    {entry.name}
                                  </p>
                                  {!isDir ? (
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                                      {formatFileSize(entry.size)}
                                      {entry.lastModified
                                        ? ` · ${formatDateTime(entry.lastModified)}`
                                        : ''}
                                    </p>
                                  ) : null}
                                </button>
                              )}
                            </div>

                            {!isRenaming ? (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    isDir
                                      ? setCurrentFolderPath(entry.path)
                                      : void handleOpenFileEditor(entry)
                                  }
                                  className="px-2.5 py-1 rounded border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-[#102A5C] dark:text-blue-200 hover:bg-[#EAF0FA] dark:hover:bg-[#1A3568] font-medium"
                                >
                                  {isDir
                                    ? t.files.openFolderAction
                                    : t.files.viewFileAction}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRenamingPath(entry.path);
                                    setRenameValue(entry.name);
                                  }}
                                  aria-label={t.files.renameAction}
                                  className="p-1.5 rounded border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#132852]"
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPendingDeleteEntry(entry)}
                                  aria-label={t.files.deletePcEntryAction}
                                  className="p-1.5 rounded border border-red-200 dark:border-red-500/35 bg-white dark:bg-[#0D1B36] text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </section>

        {/* Inline File Editor Modal */}
        {editorFile ? (
          <div className="fixed inset-0 z-50 bg-slate-950/45 dark:bg-slate-950/70 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-xl border border-blue-900/20 dark:border-blue-400/25 bg-white dark:bg-[#0D1B36] p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#1E3A8A] dark:text-blue-300">
                    {t.files.filePreviewTitle}
                  </p>
                  <h4 className="font-mono text-sm font-semibold text-[#0B1B3B] dark:text-slate-100 truncate">
                    {editorFile.path}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setEditorFile(null)}
                  className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#132852]"
                  aria-label={t.files.closePreview}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                rows={12}
                dir="auto"
                value={editorFile.content}
                onChange={(e) =>
                  setEditorFile((prev) =>
                    prev ? { ...prev, content: e.target.value } : null
                  )
                }
                className="w-full p-3 text-xs sm:text-sm font-mono rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditorFile(null)}
                  className="min-h-[38px] px-4 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#132852]"
                >
                  {t.files.closePreview}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveEditorFile()}
                  className="min-h-[38px] px-4 py-1.5 text-xs font-medium rounded-lg bg-[#102A5C] dark:bg-blue-600 text-white hover:bg-[#0B1D42] dark:hover:bg-blue-500"
                >
                  {t.files.saveFileChanges}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Delete Confirmation Modal for Manual File Browser */}
        {pendingDeleteEntry ? (
          <div className="fixed inset-0 z-50 bg-slate-950/45 dark:bg-slate-950/70 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border border-red-200 dark:border-red-500/35 bg-white dark:bg-[#0D1B36] p-5 space-y-4">
              <h4 className="font-display text-base font-semibold text-[#0B1B3B] dark:text-slate-100">
                {t.chat.deleteConfirmTitle}
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {t.chat.deleteConfirmBody}
              </p>
              <p className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/45 border border-red-200 dark:border-red-500/35 font-mono text-xs text-red-900 dark:text-red-200 break-all">
                {pendingDeleteEntry.path}
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingDeleteEntry(null)}
                  className="min-h-[38px] px-4 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#132852]"
                >
                  {t.chat.deleteConfirmCancel}
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmDeletePcEntry()}
                  className="min-h-[38px] px-4 py-1.5 text-xs font-medium rounded-lg bg-red-700 text-white hover:bg-red-800"
                >
                  {t.chat.deleteConfirmProceed}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {fileError ? (
          <div className="p-3 rounded-lg border border-red-200 dark:border-red-500/35 bg-red-50 dark:bg-red-950/45 text-xs text-red-800 dark:text-red-200">
            {fileError}
          </div>
        ) : null}

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="p-4 sm:p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              dir="auto"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.files.docTitlePlaceholder}
              className="sm:col-span-2 min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
            />
            <input
              type="text"
              dir="auto"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder={t.files.folderPlaceholder}
              className="min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
            />
          </div>
          <textarea
            rows={3}
            dir="auto"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t.files.contentPlaceholder}
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!title.trim()}
              className="min-h-[42px] px-5 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 rounded-lg transition-colors"
            >
              {t.files.saveButton}
            </button>
          </div>
        </form>

        <div className="relative max-w-sm">
          <Search
            className="h-4 w-4 text-slate-400 dark:text-slate-500 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            dir="auto"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.files.searchPlaceholder}
            className="w-full min-h-[40px] ps-9 pe-3 py-2 text-sm rounded-lg border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
          />
        </div>

        {filteredDocs.length === 0 ? (
          <div className="p-8 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-center space-y-1.5">
            <p className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">{t.files.emptyTitle}</p>
            <p className="text-xs text-slate-600 dark:text-slate-300">{t.files.emptySubtitle}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocs.map((docItem) => (
              <article
                key={docItem.id}
                className="p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 dir="auto" className="font-display text-base font-semibold text-[#0B1B3B] dark:text-slate-100">
                      {docItem.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span>{docItem.folder}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {formatDateTime(docItem.updatedAt)}
                      </span>
                      {docItem.cachedOffline ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#102A5C] dark:text-blue-300 font-medium">
                            {t.files.cachedOfflineLabel}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleExportFile(docItem)}
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#132852] transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t.files.exportFile}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void onToggleOffline(docItem.id)}
                      className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        docItem.cachedOffline
                          ? 'border-[#102A5C]/30 dark:border-blue-400/40 bg-[#EAF0FA] dark:bg-[#132852] text-[#102A5C] dark:text-blue-200'
                          : 'border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#132852]'
                      }`}
                    >
                      <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t.files.toggleOfflineCache}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteDocument(docItem.id)}
                      aria-label={t.files.deleteDoc}
                      className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-500/35 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {docItem.content ? (
                  <p
                    dir="auto"
                    className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words border-t border-blue-950/10 dark:border-blue-400/15 pt-3"
                  >
                    {docItem.content}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
          </>
        ) : null}

        {filesTab === 'media' ? (
          <section className="space-y-5">
            <div className="p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={grantedMounts.length === 0 || mediaBusy}
                  onClick={async () => {
                    setMediaBusy(true);
                    setMediaError(null);
                    try {
                      const res = await organizeMediaFiles(computerMounts, currentFolderPath, false);
                      setMediaReport(res);
                    } catch (err) {
                      setMediaError(err instanceof Error ? err.message : t.files.fileActionError);
                    } finally {
                      setMediaBusy(false);
                    }
                  }}
                  className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-white dark:bg-[#132852] text-[#102A5C] dark:text-blue-200 hover:bg-[#EAF0FA] dark:hover:bg-[#1A3568] disabled:opacity-40"
                >
                  <Image className="h-4 w-4" aria-hidden="true" />
                  <span>{t.extras.scanMediaButton}</span>
                </button>
                <button
                  type="button"
                  disabled={grantedMounts.length === 0 || mediaBusy}
                  onClick={async () => {
                    setMediaBusy(true);
                    setMediaError(null);
                    try {
                      const res = await organizeMediaFiles(computerMounts, currentFolderPath, true);
                      setMediaReport(res);
                      await onRefreshMounts();
                    } catch (err) {
                      setMediaError(err instanceof Error ? err.message : t.files.fileActionError);
                    } finally {
                      setMediaBusy(false);
                    }
                  }}
                  className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 text-white disabled:opacity-40"
                >
                  <Folder className="h-4 w-4" aria-hidden="true" />
                  <span>{t.extras.organizeMediaButton}</span>
                </button>
              </div>
            </div>

            {grantedMounts.length === 0 ? (
              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-500/35 bg-amber-50 dark:bg-amber-950/45 text-xs text-amber-900 dark:text-amber-200">
                {t.files.noComputerFolders}
              </div>
            ) : null}

            {mediaError ? (
              <div className="p-4 rounded-xl border border-red-200 dark:border-red-500/35 bg-red-50 dark:bg-red-950/45 text-xs text-red-800 dark:text-red-200">
                {mediaError}
              </div>
            ) : null}

            {mediaReport ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {(
                  [
                    ['Photos', t.extras.mediaPhotos],
                    ['Videos', t.extras.mediaVideos],
                    ['Audio', t.extras.mediaAudio],
                    ['Documents', t.extras.mediaDocs],
                  ] as const
                ).map(([key, label]) => {
                  const map = mediaReport.filesByCategory as Record<string, string[]> | undefined;
                  const list = map?.[key] ?? [];
                  return (
                    <div
                      key={key}
                      className="p-4 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-2"
                    >
                      <p className="text-xs font-semibold text-[#102A5C] dark:text-blue-300">{label}</p>
                      <p className="text-xl font-mono tabular-nums font-semibold text-[#0B1B3B] dark:text-slate-100">
                        {formatNumber(list.length)}
                      </p>
                      {list.length > 0 ? (
                        <ul className="text-[11px] font-mono text-slate-600 dark:text-slate-300 space-y-0.5 max-h-32 overflow-y-auto">
                          {list.slice(0, 12).map((f) => (
                            <li key={f} className="truncate">
                              {f}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        ) : null}

        {filesTab === 'backups' ? (
          <section className="space-y-5">
            <div className="p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  setBackupError(null);
                  setBackupStatus(null);
                  try {
                    const res = await onCreateVerifiedBackup(
                      workspaceSnapshot,
                      computerMounts,
                      'Backups',
                      'json'
                    );
                    setBackupStatus(
                      `${t.extras.backupStatusSuccess}: ${res.filename} (SHA-256: ${res.checksumHex})${res.savedToPcPath ? ` -> ${res.savedToPcPath}` : ''}`
                    );
                  } catch (err) {
                    setBackupError(err instanceof Error ? err.message : t.files.fileActionError);
                  }
                }}
                className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 text-white"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>{t.extras.backupJsonButton}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  setBackupError(null);
                  setBackupStatus(null);
                  try {
                    const res = await onCreateVerifiedBackup(
                      workspaceSnapshot,
                      computerMounts,
                      'Backups',
                      'zip'
                    );
                    setBackupStatus(
                      `${t.extras.backupStatusSuccess}: ${res.filename} (SHA-256: ${res.checksumHex})`
                    );
                  } catch (err) {
                    setBackupError(err instanceof Error ? err.message : t.files.fileActionError);
                  }
                }}
                className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-white dark:bg-[#132852] text-[#102A5C] dark:text-blue-200 hover:bg-[#EAF0FA] dark:hover:bg-[#1A3568]"
              >
                <FileArchive className="h-4 w-4" aria-hidden="true" />
                <span>{t.extras.backupZipButton}</span>
              </button>

              <input
                ref={restoreInputRef}
                type="file"
                accept=".json,application/json"
                onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setBackupError(null);
                  setBackupStatus(null);
                  try {
                    const text = await file.text();
                    const parsed = JSON.parse(text) as { workspace?: Partial<WorkspaceSnapshot> };
                    const ws = parsed.workspace ?? (parsed as Partial<WorkspaceSnapshot>);
                    if (!ws || typeof ws !== 'object') {
                      throw new Error('Invalid backup structure.');
                    }
                    const restoredCount = await onRestoreBackupSnapshot(ws);
                    setBackupStatus(`Restored ${formatNumber(restoredCount)} workspace records.`);
                  } catch (err) {
                    setBackupError(err instanceof Error ? err.message : t.files.fileActionError);
                  }
                }}
                className="sr-only"
              />
              <button
                type="button"
                onClick={() => restoreInputRef.current?.click()}
                className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#132852] text-[#102A5C] dark:text-blue-200 hover:bg-[#EAF0FA] dark:hover:bg-[#1A3568]"
              >
                <FileUp className="h-4 w-4" aria-hidden="true" />
                <span>{t.extras.restoreBackupButton}</span>
              </button>
            </div>

            {backupError ? (
              <div className="p-4 rounded-xl border border-red-200 dark:border-red-500/35 bg-red-50 dark:bg-red-950/45 text-xs text-red-800 dark:text-red-200">
                {backupError}
              </div>
            ) : null}
            {backupStatus ? (
              <div className="p-4 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-[#EAF0FA] dark:bg-[#132852] text-xs font-mono text-[#0B1B3B] dark:text-blue-100">
                {backupStatus}
              </div>
            ) : null}
          </section>
        ) : null}

        {filesTab === 'clipboard' ? (
          <section className="space-y-5">
            <div className="p-4 sm:p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setClipNotice(null);
                    try {
                      const txt = await navigator.clipboard?.readText();
                      if (txt) {
                        onSaveClipboardEntry(txt, 'System Clipboard');
                        setClipNotice('Captured from clipboard.');
                      }
                    } catch {
                      setClipNotice('Clipboard read requires active browser permission; paste text manually below.');
                    }
                  }}
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#132852] hover:bg-[#EAF0FA] dark:hover:bg-[#1A3568] text-[#102A5C] dark:text-blue-200"
                >
                  <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.extras.captureClipboardButton}</span>
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!clipText.trim()) return;
                  onSaveClipboardEntry(clipText.trim(), clipLabel.trim() || undefined);
                  setClipText('');
                  setClipLabel('');
                }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <input
                  type="text"
                  dir="auto"
                  value={clipLabel}
                  onChange={(e) => setClipLabel(e.target.value)}
                  placeholder="Label (optional)"
                  className="sm:w-1/4 min-h-[42px] px-3 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                />
                <input
                  type="text"
                  dir="auto"
                  value={clipText}
                  onChange={(e) => setClipText(e.target.value)}
                  placeholder={t.extras.clipboardPlaceholder}
                  className="flex-1 min-h-[42px] px-3 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!clipText.trim()}
                  className="min-h-[42px] px-4 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 rounded-lg whitespace-nowrap"
                >
                  {t.extras.saveClipboardButton}
                </button>
              </form>
              {clipNotice ? <p className="text-xs text-[#102A5C] dark:text-blue-300">{clipNotice}</p> : null}
            </div>

            <div className="relative max-w-sm">
              <Search
                className="h-4 w-4 text-slate-400 dark:text-slate-500 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                dir="auto"
                value={clipSearch}
                onChange={(e) => setClipSearch(e.target.value)}
                placeholder={t.tasks.searchPlaceholder}
                className="w-full min-h-[40px] ps-9 pe-3 py-2 text-sm rounded-lg border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
              />
            </div>

            <div className="border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] rounded-xl divide-y divide-blue-950/10 dark:divide-blue-400/15">
              {clipboardHistory
                .filter((c) => {
                  const q = clipSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    c.text.toLowerCase().includes(q) ||
                    (c.label ?? '').toLowerCase().includes(q)
                  );
                })
                .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
                .map((clip) => (
                  <div
                    key={clip.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      {clip.label ? (
                        <p className="text-xs font-semibold text-[#1E3A8A] dark:text-blue-300">{clip.label}</p>
                      ) : null}
                      <p dir="auto" className="text-xs sm:text-sm text-[#0B1B3B] dark:text-slate-100 break-words">
                        {clip.text}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                        {formatDateTime(clip.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onTogglePinClipboard(clip.id)}
                        className={`p-2 rounded border ${
                          clip.pinned
                            ? 'bg-[#EAF0FA] dark:bg-[#132852] border-[#102A5C] dark:border-blue-400 text-[#102A5C] dark:text-blue-200'
                            : 'border-blue-900/15 dark:border-blue-400/20 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#132852]'
                        }`}
                        aria-label="Pin"
                      >
                        <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(clip.text);
                          setClipNotice('Copied to clipboard.');
                        }}
                        className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-blue-900/15 dark:border-blue-400/20 text-[#102A5C] dark:text-blue-200 hover:bg-[#EAF0FA] dark:hover:bg-[#1A3568]"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{t.extras.copyAction}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteClipboardEntry(clip.id)}
                        aria-label={t.tasks.deleteTask}
                        className="p-2 rounded border border-red-200 dark:border-red-500/35 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
