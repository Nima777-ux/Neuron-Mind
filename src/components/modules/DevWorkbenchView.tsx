import {
  ArrowRight,
  Code2,
  Database,
  Download,
  FolderPlus,
  GitBranch,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLanguage } from '../../i18n/languageContext';
import {
  inspectGitRepository,
  listComputerDirectory,
  readComputerFile,
  scaffoldSoftwareProject,
  writeComputerFile,
  type ComputerEntryInfo,
  type ComputerFolderMount,
} from '../../lib/platform/computerFiles';
import type { DataTableSchema } from '../../types/assistant';

interface DevWorkbenchViewProps {
  computerMounts: ComputerFolderMount[];
  onRefreshMounts: () => Promise<void>;
  dataTables: DataTableSchema[];
  onCreateDataTable: (name: string, columns: string[]) => DataTableSchema;
  onInsertTableRow: (tableId: string, row: Record<string, string>) => void;
  onDeleteTableRow: (tableId: string, rowIdx: number) => void;
  onDeleteDataTable: (tableId: string) => void;
  onDraftInAssistant: (prompt: string) => void;
  onLogActivity: (entry: {
    category: 'system' | 'files';
    title: string;
    details?: string;
    status: 'success' | 'warning' | 'error';
  }) => void;
}

type WorkbenchTab = 'code' | 'git' | 'scaffold' | 'tables';

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function DevWorkbenchView({
  computerMounts,
  onRefreshMounts,
  dataTables,
  onCreateDataTable,
  onInsertTableRow,
  onDeleteTableRow,
  onDeleteDataTable,
  onDraftInAssistant,
  onLogActivity,
}: DevWorkbenchViewProps) {
  const { t, formatNumber } = useLanguage();
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('code');

  const grantedMounts = computerMounts.filter((m) => m.permission === 'granted');

  // Code Helper state
  const [codeFiles, setCodeFiles] = useState<ComputerEntryInfo[]>([]);
  const [selectedCodePath, setSelectedCodePath] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [codeStatus, setCodeStatus] = useState<string | null>(null);

  // Git Inspector state
  const [gitSubPath, setGitSubPath] = useState('');
  const [gitInfo, setGitInfo] = useState<Record<string, unknown> | null>(null);
  const [gitError, setGitError] = useState<string | null>(null);

  // Project Builder state
  const [projectFolder, setProjectFolder] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectTemplate, setProjectTemplate] = useState<
    'node-ts' | 'react-vite-ts' | 'python-cli' | 'static-web'
  >('node-ts');
  const [scaffoldResult, setScaffoldResult] = useState<string[] | null>(null);
  const [scaffoldError, setScaffoldError] = useState<string | null>(null);

  // Database Tables state
  const [newTableName, setNewTableName] = useState('');
  const [newTableColumns, setNewTableColumns] = useState('');
  const [rowDrafts, setRowDrafts] = useState<Record<string, Record<string, string>>>({});
  const [tableFilters, setTableFilters] = useState<Record<string, string>>({});

  const loadFolderCodeFiles = async () => {
    setCodeStatus(null);
    try {
      const listing = await listComputerDirectory(computerMounts, '', true, 3);
      setCodeFiles(listing.entries.filter((e) => e.kind === 'file').slice(0, 60));
    } catch (err) {
      setCodeStatus(err instanceof Error ? err.message : t.files.fileActionError);
    }
  };

  const openCodeFile = async (filePath: string) => {
    setCodeStatus(null);
    try {
      const res = await readComputerFile(computerMounts, filePath);
      setSelectedCodePath(res.path);
      setCodeSnippet(res.content);
    } catch (err) {
      setCodeStatus(err instanceof Error ? err.message : t.files.fileActionError);
    }
  };

  const saveCodeFile = async () => {
    if (!selectedCodePath) return;
    setCodeStatus(null);
    try {
      await writeComputerFile(computerMounts, selectedCodePath, codeSnippet, 'overwrite');
      setCodeStatus(`Saved ${selectedCodePath}`);
    } catch (err) {
      setCodeStatus(err instanceof Error ? err.message : t.files.fileActionError);
    }
  };

  const handleInspectGit = async (e: FormEvent) => {
    e.preventDefault();
    setGitError(null);
    try {
      const info = await inspectGitRepository(computerMounts, gitSubPath.trim());
      setGitInfo(info);
      onLogActivity({
        category: 'system',
        title: `Git metadata inspected: ${gitSubPath.trim() || 'Root'}`,
        status: info.isGitRepo ? 'success' : 'warning',
      });
    } catch (err) {
      setGitError(err instanceof Error ? err.message : 'Unable to inspect .git metadata.');
    }
  };

  const handleScaffold = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    setScaffoldError(null);
    setScaffoldResult(null);
    try {
      const res = await scaffoldSoftwareProject(
        computerMounts,
        projectFolder.trim(),
        projectName.trim(),
        projectTemplate
      );
      const created = Array.isArray(res.createdFiles)
        ? (res.createdFiles as string[])
        : [];
      setScaffoldResult(created);
      await onRefreshMounts();
      onLogActivity({
        category: 'files',
        title: `Scaffolded ${projectTemplate} project: ${projectName.trim()}`,
        details: `${created.length} files`,
        status: 'success',
      });
    } catch (err) {
      setScaffoldError(
        err instanceof Error ? err.message : 'Unable to create project files.'
      );
    }
  };

  const handleCreateTable = (e: FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim() || !newTableColumns.trim()) return;
    const cols = newTableColumns
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    if (cols.length === 0) return;
    onCreateDataTable(newTableName.trim(), cols);
    setNewTableName('');
    setNewTableColumns('');
  };

  const handleExportCsv = (table: DataTableSchema) => {
    const header = table.columns.map(escapeCsvCell).join(',');
    const lines = table.rows.map((r) =>
      table.columns.map((c) => escapeCsvCell(r[c] ?? '')).join(',')
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${table.name.toLowerCase().replace(/[^a-z0-9-_]+/gi, '_') || 'table'}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const tabs: Array<{ id: WorkbenchTab; label: string }> = [
    { id: 'code', label: t.workbench.tabCode },
    { id: 'git', label: t.workbench.tabGit },
    { id: 'scaffold', label: t.workbench.tabScaffold },
    { id: 'tables', label: t.workbench.tabTables },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFD] dark:bg-[#071126] px-4 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <section className="space-y-2">
          <p className="text-xs font-medium text-[#1E3A8A]/80 dark:text-blue-300/80">{t.workbench.kicker}</p>
          <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight text-[#0B1B3B] dark:text-slate-100">
            {t.workbench.title}
          </h2>
          <p className="text-sm lg:text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            {t.workbench.subtitle}
          </p>
        </section>

        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#EAF0FA] dark:bg-[#132852] border border-blue-900/10 dark:border-blue-400/20">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[36px] px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-[#0D1B36] text-[#0B1B3B] dark:text-slate-100 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-[#0B1B3B] dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'code' ? (
          <section className="p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
                <Code2 className="h-4 w-4 text-[#102A5C] dark:text-blue-300" aria-hidden="true" />
                <span>{selectedCodePath || t.workbench.tabCode}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {grantedMounts.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => void loadFolderCodeFiles()}
                    className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#132852] hover:bg-[#EAF0FA] dark:hover:bg-[#1A3568] text-[#102A5C] dark:text-blue-200"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.files.refreshFolder}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={!codeSnippet.trim()}
                  onClick={() =>
                    onDraftInAssistant(
                      `Analyze, debug, or optimize this code${selectedCodePath ? ` (${selectedCodePath})` : ''}:\n\n\`\`\`\n${codeSnippet.slice(0, 6000)}\n\`\`\``
                    )
                  }
                  className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:opacity-40 text-white"
                >
                  <span>{t.workbench.sendCodeToAi}</span>
                  <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                </button>
              </div>
            </div>

            {codeFiles.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 rounded-lg bg-[#F8FAFD] dark:bg-[#09142B] border border-blue-900/10 dark:border-blue-400/20">
                {codeFiles.map((file) => (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => void openCodeFile(file.path)}
                    className={`px-2.5 py-1 text-xs font-mono rounded border ${
                      selectedCodePath === file.path
                        ? 'bg-[#102A5C] dark:bg-blue-600 text-white border-[#102A5C] dark:border-blue-500'
                        : 'bg-white dark:bg-[#0D1B36] text-slate-700 dark:text-slate-200 border-blue-900/15 dark:border-blue-400/20 hover:bg-[#EAF0FA] dark:hover:bg-[#1A3568]'
                    }`}
                  >
                    {file.path}
                  </button>
                ))}
              </div>
            ) : null}

            <textarea
              rows={12}
              dir="ltr"
              value={codeSnippet}
              onChange={(e) => setCodeSnippet(e.target.value)}
              placeholder="// Load a file from a connected computer folder or paste source code here..."
              className="w-full p-3.5 text-xs sm:text-sm font-mono rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
            />

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-600 dark:text-slate-300">{codeStatus ?? ''}</span>
              {selectedCodePath ? (
                <button
                  type="button"
                  onClick={() => void saveCodeFile()}
                  className="min-h-[38px] px-4 py-1.5 text-xs font-medium rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#EFF4FB] dark:bg-[#132852] hover:bg-[#EAF0FA] dark:hover:bg-[#1A3568] text-[#102A5C] dark:text-blue-200"
                >
                  {t.files.saveFileChanges}
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeTab === 'git' ? (
          <section className="space-y-5">
            <form
              onSubmit={(e) => void handleInspectGit(e)}
              className="p-4 sm:p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] flex flex-col sm:flex-row gap-3"
            >
              <input
                type="text"
                dir="ltr"
                value={gitSubPath}
                onChange={(e) => setGitSubPath(e.target.value)}
                placeholder={t.workbench.gitPathPlaceholder}
                className="flex-1 min-h-[44px] px-3.5 py-2 text-sm font-mono rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={grantedMounts.length === 0}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 rounded-lg transition-colors whitespace-nowrap"
              >
                <GitBranch className="h-4 w-4" aria-hidden="true" />
                <span>{t.workbench.inspectGitButton}</span>
              </button>
            </form>

            {grantedMounts.length === 0 ? (
              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-500/35 bg-amber-50 dark:bg-amber-950/45 text-xs text-amber-900 dark:text-amber-200">
                {t.files.noComputerFolders}
              </div>
            ) : null}

            {gitError ? (
              <div className="p-4 rounded-xl border border-red-200 dark:border-red-500/35 bg-red-50 dark:bg-red-950/45 text-xs text-red-800 dark:text-red-200">
                {gitError}
              </div>
            ) : null}

            {gitInfo ? (
              <div className="p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-4 text-xs">
                {typeof gitInfo.note === 'string' ? (
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{gitInfo.note}</p>
                ) : null}
                {gitInfo.isGitRepo ? (
                  <div className="space-y-4">
                    <dl className="divide-y divide-blue-950/10 dark:divide-blue-400/15">
                      <div className="py-2 flex items-center justify-between gap-4">
                        <dt className="text-slate-500 dark:text-slate-400">{t.workbench.gitBranchLabel}</dt>
                        <dd className="font-mono font-semibold text-[#102A5C] dark:text-blue-300">
                          {String(gitInfo.currentBranch ?? '—')}
                        </dd>
                      </div>
                      <div className="py-2 flex items-start justify-between gap-4">
                        <dt className="text-slate-500 dark:text-slate-400">{t.workbench.gitRemotesLabel}</dt>
                        <dd className="font-mono text-slate-700 dark:text-slate-200 text-end break-all">
                          {Array.isArray(gitInfo.remotes) && gitInfo.remotes.length > 0
                            ? (gitInfo.remotes as string[]).join(', ')
                            : '—'}
                        </dd>
                      </div>
                    </dl>
                    {Array.isArray(gitInfo.recentCommits) && gitInfo.recentCommits.length > 0 ? (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-[#0B1B3B] dark:text-slate-100">
                          {t.workbench.gitCommitsLabel}
                        </h4>
                        <ul className="divide-y divide-blue-950/10 dark:divide-blue-400/15 border border-blue-900/10 dark:border-blue-400/20 rounded-lg">
                          {(
                            gitInfo.recentCommits as Array<{ commit: string; message: string }>
                          ).map((c, idx) => (
                            <li key={`${c.commit}-${idx}`} className="px-3 py-2 flex items-center gap-3">
                              <span className="font-mono text-[#1E3A8A] dark:text-blue-300 shrink-0">
                                {c.commit || 'HEAD'}
                              </span>
                              <span className="text-slate-700 dark:text-slate-200 truncate">{c.message}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTab === 'scaffold' ? (
          <section className="space-y-5">
            <form
              onSubmit={(e) => void handleScaffold(e)}
              className="p-4 sm:p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  dir="ltr"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder={t.workbench.projectNamePlaceholder}
                  className="min-h-[44px] px-3.5 py-2 text-sm font-mono rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                />
                <input
                  type="text"
                  dir="ltr"
                  value={projectFolder}
                  onChange={(e) => setProjectFolder(e.target.value)}
                  placeholder={t.workbench.gitPathPlaceholder}
                  className="min-h-[44px] px-3.5 py-2 text-sm font-mono rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                />
                <select
                  value={projectTemplate}
                  onChange={(e) =>
                    setProjectTemplate(
                      e.target.value as 'node-ts' | 'react-vite-ts' | 'python-cli' | 'static-web'
                    )
                  }
                  aria-label={t.workbench.templateLabel}
                  className="min-h-[44px] px-3 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                >
                  <option value="node-ts" className="bg-white dark:bg-[#0D1B36]">Node.js + TypeScript</option>
                  <option value="react-vite-ts" className="bg-white dark:bg-[#0D1B36]">React + Vite + TypeScript</option>
                  <option value="python-cli" className="bg-white dark:bg-[#0D1B36]">Python CLI</option>
                  <option value="static-web" className="bg-white dark:bg-[#0D1B36]">Static HTML/CSS/JS</option>
                </select>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!projectName.trim() || grantedMounts.length === 0}
                  className="min-h-[42px] inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 rounded-lg transition-colors"
                >
                  <FolderPlus className="h-4 w-4" aria-hidden="true" />
                  <span>{t.workbench.scaffoldButton}</span>
                </button>
              </div>
            </form>

            {grantedMounts.length === 0 ? (
              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-500/35 bg-amber-50 dark:bg-amber-950/45 text-xs text-amber-900 dark:text-amber-200">
                {t.files.noComputerFolders}
              </div>
            ) : null}

            {scaffoldError ? (
              <div className="p-4 rounded-xl border border-red-200 dark:border-red-500/35 bg-red-50 dark:bg-red-950/45 text-xs text-red-800 dark:text-red-200">
                {scaffoldError}
              </div>
            ) : null}

            {scaffoldResult ? (
              <div className="p-4 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-2 text-xs">
                <p className="font-semibold text-[#0B1B3B] dark:text-slate-100">Created files:</p>
                <ul className="font-mono text-[#102A5C] dark:text-blue-300 space-y-1">
                  {scaffoldResult.map((path) => (
                    <li key={path}>{path}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTab === 'tables' ? (
          <section className="space-y-5">
            <form
              onSubmit={handleCreateTable}
              className="p-4 sm:p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              <input
                type="text"
                dir="auto"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder={t.workbench.tableNamePlaceholder}
                className="min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
              />
              <input
                type="text"
                dir="auto"
                value={newTableColumns}
                onChange={(e) => setNewTableColumns(e.target.value)}
                placeholder={t.workbench.tableColumnsPlaceholder}
                className="min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newTableName.trim() || !newTableColumns.trim()}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 rounded-lg transition-colors whitespace-nowrap"
              >
                <Database className="h-4 w-4" aria-hidden="true" />
                <span>{t.workbench.createTableButton}</span>
              </button>
            </form>

            {dataTables.length === 0 ? (
              <div className="p-8 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-center space-y-1.5">
                <p className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
                  {t.workbench.noTablesTitle}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">{t.workbench.noTablesDesc}</p>
              </div>
            ) : (
              <div className="space-y-5">
                {dataTables.map((table) => {
                  const draft = rowDrafts[table.id] ?? {};
                  const filterText = (tableFilters[table.id] ?? '').trim().toLowerCase();
                  const visibleRows = table.rows
                    .map((r, originalIdx) => ({ r, originalIdx }))
                    .filter(({ r }) =>
                      !filterText
                        ? true
                        : Object.values(r).some((v) =>
                            String(v).toLowerCase().includes(filterText)
                          )
                    );

                  return (
                    <article
                      key={table.id}
                      className="p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 dir="auto" className="font-display text-base font-semibold text-[#0B1B3B] dark:text-slate-100">
                            {table.name}
                          </h3>
                          <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                            {formatNumber(table.rows.length)} rows
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="search"
                            dir="auto"
                            value={tableFilters[table.id] ?? ''}
                            onChange={(e) =>
                              setTableFilters((prev) => ({
                                ...prev,
                                [table.id]: e.target.value,
                              }))
                            }
                            placeholder={t.tasks.searchPlaceholder}
                            className="min-h-[34px] px-2.5 py-1 text-xs rounded-md border border-blue-900/15 dark:border-blue-400/20 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleExportCsv(table)}
                            className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-[#102A5C] dark:text-blue-200 hover:bg-[#EAF0FA] dark:hover:bg-[#1A3568]"
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{t.workbench.exportCsvButton}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteDataTable(table.id)}
                            aria-label={t.tasks.deleteTask}
                            className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-md border border-red-200 dark:border-red-500/35 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const cleanRow: Record<string, string> = {};
                          for (const col of table.columns) {
                            cleanRow[col] = (draft[col] ?? '').trim();
                          }
                          if (Object.values(cleanRow).every((v) => !v)) return;
                          onInsertTableRow(table.id, cleanRow);
                          setRowDrafts((prev) => ({ ...prev, [table.id]: {} }));
                        }}
                        className="flex flex-wrap items-center gap-2"
                      >
                        {table.columns.map((col) => (
                          <input
                            key={col}
                            type="text"
                            dir="auto"
                            value={draft[col] ?? ''}
                            onChange={(e) =>
                              setRowDrafts((prev) => ({
                                ...prev,
                                [table.id]: { ...draft, [col]: e.target.value },
                              }))
                            }
                            placeholder={col}
                            className="min-w-[120px] flex-1 min-h-[36px] px-2.5 py-1 text-xs rounded-md border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                          />
                        ))}
                        <button
                          type="submit"
                          className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md bg-[#102A5C] dark:bg-blue-600 text-white hover:bg-[#0B1D42] dark:hover:bg-blue-500 whitespace-nowrap"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{t.workbench.addRowButton}</span>
                        </button>
                      </form>

                      <div className="overflow-x-auto border border-blue-900/10 dark:border-blue-400/20 rounded-lg">
                        <table className="w-full text-start border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-blue-950/10 dark:border-blue-400/15 bg-[#EFF4FB] dark:bg-[#132852] text-[#102A5C] dark:text-blue-200 font-medium">
                              {table.columns.map((col) => (
                                <th key={col} className="py-2 px-3 text-start">
                                  {col}
                                </th>
                              ))}
                              <th className="py-2 px-3 text-end" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-blue-950/10 dark:divide-blue-400/15">
                            {visibleRows.map(({ r, originalIdx }) => (
                              <tr key={originalIdx} className="hover:bg-[#F5F8FD] dark:hover:bg-[#132852]/60">
                                {table.columns.map((col) => (
                                  <td key={col} dir="auto" className="py-2 px-3 text-slate-700 dark:text-slate-200">
                                    {r[col] || '—'}
                                  </td>
                                ))}
                                <td className="py-2 px-3 text-end">
                                  <button
                                    type="button"
                                    onClick={() => onDeleteTableRow(table.id, originalIdx)}
                                    aria-label={t.tasks.deleteTask}
                                    className="p-1 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 rounded"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
