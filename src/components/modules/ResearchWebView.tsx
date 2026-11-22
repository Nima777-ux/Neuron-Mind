import {
  ChevronDown,
  Download,
  ExternalLink,
  FolderPlus,
  Globe,
  Info,
  KeyRound,
  Link2,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useLanguage } from '../../i18n/languageContext';
import {
  writeComputerBinaryFile,
  type ComputerFolderMount,
} from '../../lib/platform/computerFiles';
import {
  AssistantApiError,
  downloadRemoteUrl,
  inspectPublicUrl,
  runWebResearch,
  type VideoQualityOption,
} from '../../services/assistantApi';
import type { AuthorizedAppLink, DownloadRecord } from '../../types/assistant';

interface ResearchWebViewProps {
  isOnline: boolean;
  downloads: DownloadRecord[];
  onAddDownloadRecord: (record: Omit<DownloadRecord, 'id' | 'createdAt'>) => void;
  authorizedApps: AuthorizedAppLink[];
  onAddAuthorizedApp: (app: Omit<AuthorizedAppLink, 'id'>) => void;
  onRemoveAuthorizedApp: (id: string) => void;
  onRestoreRecommendedApps?: () => void;
  computerMounts: ComputerFolderMount[];
  onConnectFolder?: () => Promise<unknown>;
  onLogActivity: (entry: {
    category: 'research' | 'security';
    title: string;
    details?: string;
    status: 'success' | 'warning' | 'error';
  }) => void;
  onDraftInAssistant: (prompt: string) => void;
}

type ResearchTab = 'search' | 'browser' | 'downloads' | 'apps';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function cleanErrorMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : fallback;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: { message?: string }; message?: string };
      return parsed.error?.message || parsed.message || fallback;
    } catch {
      return raw;
    }
  }
  return raw;
}

export function ResearchWebView({
  isOnline,
  downloads,
  onAddDownloadRecord,
  authorizedApps,
  onAddAuthorizedApp,
  onRemoveAuthorizedApp,
  onRestoreRecommendedApps,
  computerMounts,
  onConnectFolder,
  onLogActivity,
}: ResearchWebViewProps) {
  const { language, t, formatDateTime, formatNumber } = useLanguage();
  const [activeTab, setActiveTab] = useState<ResearchTab>('search');

  // Internet Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<{
    summary: string;
    sources: Array<{ title: string; uri: string }>;
  } | null>(null);

  // Webpage Inspector state
  const [inspectUrl, setInspectUrl] = useState('');
  const [inspectPrompt, setInspectPrompt] = useState('');
  const [inspectBusy, setInspectBusy] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [inspectResult, setInspectResult] = useState<{
    url: string;
    analysis: string;
    sources: Array<{ title: string; uri: string }>;
  } | null>(null);

  // Download Manager state
  const [downloadUrl, setDownloadUrl] = useState('');
  const [videoQuality, setVideoQuality] = useState<VideoQualityOption>('best');
  const [showYoutubeOptions, setShowYoutubeOptions] = useState(false);
  const [youtubeCookies, setYoutubeCookies] = useState('');
  const [cobaltApiUrl, setCobaltApiUrl] = useState('');
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // App Launcher state
  const [appName, setAppName] = useState('');
  const [appUri, setAppUri] = useState('');
  const [appError, setAppError] = useState<string | null>(null);
  const [appFilter, setAppFilter] = useState<'all' | 'app' | 'web'>('all');

  const handleRunSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !isOnline) return;
    setSearchBusy(true);
    setSearchError(null);
    try {
      const res = await runWebResearch(searchQuery.trim(), language);
      const safeSources = Array.isArray(res?.sources) ? res.sources : [];
      setSearchResult({
        summary: res?.summary || '',
        sources: safeSources,
      });
      onLogActivity({
        category: 'research',
        title: `Web search: ${searchQuery.trim().slice(0, 60)}`,
        details: `${safeSources.length} sources`,
        status: 'success',
      });
    } catch (err) {
      setSearchError(cleanErrorMessage(err, 'Search failed.'));
    } finally {
      setSearchBusy(false);
    }
  };

  const handleInspectPage = async (e: FormEvent) => {
    e.preventDefault();
    if (!inspectUrl.trim() || !isOnline) return;
    setInspectBusy(true);
    setInspectError(null);
    try {
      const targetUrl = inspectUrl.trim();
      const res = await inspectPublicUrl(
        targetUrl,
        inspectPrompt.trim(),
        language
      );
      if (!res || typeof res.analysis !== 'string') {
        throw new Error('Inspection returned no readable webpage data.');
      }
      const safeUrl = res.url || targetUrl;
      setInspectResult({
        url: safeUrl,
        analysis: res.analysis,
        sources: Array.isArray(res.sources) ? res.sources : [],
      });
      onLogActivity({
        category: 'research',
        title: `Inspected webpage: ${safeUrl}`,
        status: 'success',
      });
    } catch (err) {
      setInspectError(cleanErrorMessage(err, 'Inspection failed.'));
    } finally {
      setInspectBusy(false);
    }
  };

  const handleCookiesFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setYoutubeCookies(text);
    e.target.value = '';
  };

  const handleDownloadFile = async (e: FormEvent) => {
    e.preventDefault();
    if (!downloadUrl.trim() || !isOnline) return;
    setDownloadBusy(true);
    setDownloadError(null);
    setDownloadSuccess(null);
    try {
      const res = await downloadRemoteUrl(downloadUrl.trim(), {
        quality: videoQuality,
        cookiesText: youtubeCookies,
        cobaltApiUrl,
      });
      const granted = computerMounts.filter((m) => m.permission === 'granted');
      let savedLocation: 'computer_folder' | 'browser_download' = 'browser_download';
      let locationNote = res.filename;

      if (granted.length > 0) {
        const rawBytes = new Uint8Array(await res.blob.arrayBuffer());
        const dest = `${granted[0].name}/Downloads/${res.filename}`;
        const writeRes = await writeComputerBinaryFile(computerMounts, dest, rawBytes);
        savedLocation = 'computer_folder';
        locationNote = writeRes.path;
      } else {
        const blobUrl = URL.createObjectURL(res.blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = res.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
      }

      onAddDownloadRecord({
        url: res.url,
        filename: res.filename,
        mimeType: res.mimeType,
        sizeBytes: res.sizeBytes,
        savedLocation,
      });
      onLogActivity({
        category: 'research',
        title: `Downloaded: ${res.filename}`,
        details: `${formatBytes(res.sizeBytes)} · ${res.mimeType}`,
        status: 'success',
      });
      setDownloadSuccess(`${res.filename} (${formatBytes(res.sizeBytes)}) -> ${locationNote}`);
      setDownloadUrl('');
    } catch (err) {
      if (err instanceof AssistantApiError && err.code === 'YOUTUBE_BOT_VERIFICATION') {
        setShowYoutubeOptions(true);
      }
      setDownloadError(cleanErrorMessage(err, 'Download failed.'));
    } finally {
      setDownloadBusy(false);
    }
  };

  const handleAddApp = (e: FormEvent) => {
    e.preventDefault();
    setAppError(null);
    const cleanName = appName.trim();
    const cleanUri = appUri.trim();
    if (!cleanName || !cleanUri) return;
    const valid =
      /^(https?:|mailto:|tel:|vscode:|ms-settings:|calculator:|ms-clock:|ms-windows-store:|spotify:|discord:|tg:|whatsapp:|notion:|obsidian:)/i.test(
        cleanUri
      );
    if (!valid) {
      setAppError(
        'Supported URIs: https://, http://, mailto:, tel:, vscode:, ms-settings:, calculator:, spotify:, discord:, tg:, whatsapp:, notion:, obsidian:'
      );
      return;
    }
    onAddAuthorizedApp({
      name: cleanName,
      uri: cleanUri,
      category: /^https?:/i.test(cleanUri) ? 'web' : 'app',
    });
    onLogActivity({
      category: 'security',
      title: `Authorized app launcher: ${cleanName}`,
      details: cleanUri,
      status: 'success',
    });
    setAppName('');
    setAppUri('');
  };

  const filteredApps = authorizedApps.filter((a) =>
    appFilter === 'all' ? true : a.category === appFilter
  );
  const grantedMounts = computerMounts.filter((m) => m.permission === 'granted');

  const tabs: Array<{ id: ResearchTab; label: string }> = [
    { id: 'search', label: t.research.tabSearch },
    { id: 'browser', label: t.research.tabBrowser },
    { id: 'downloads', label: t.research.tabDownloads },
    { id: 'apps', label: t.research.tabApps },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFD] dark:bg-[#071126] px-4 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <section className="space-y-2">
          <p className="text-xs font-medium text-[#1E3A8A]/80 dark:text-blue-300/80">{t.research.kicker}</p>
          <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight text-[#0B1B3B] dark:text-slate-100">
            {t.research.title}
          </h2>
          <p className="text-sm lg:text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            {t.research.subtitle}
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

        {activeTab === 'search' ? (
          <section className="space-y-5">
            <form
              onSubmit={(e) => void handleRunSearch(e)}
              className="p-4 sm:p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] flex flex-col sm:flex-row gap-3"
            >
              <div className="relative flex-1">
                <Search
                  className="h-4 w-4 text-slate-400 dark:text-slate-500 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  dir="auto"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.research.queryPlaceholder}
                  className="w-full min-h-[44px] ps-9 pe-3 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={!searchQuery.trim() || !isOnline || searchBusy}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 rounded-lg transition-colors whitespace-nowrap"
              >
                {searchBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Globe className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{searchBusy ? t.research.searching : t.research.searchButton}</span>
              </button>
            </form>

            {searchError ? (
              <div className="p-4 rounded-xl border border-red-200 dark:border-red-500/35 bg-red-50 dark:bg-red-950/45 text-xs text-red-800 dark:text-red-200">
                {searchError}
              </div>
            ) : null}

            {searchResult ? (
              <div className="space-y-4">
                <article className="p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-3">
                  <div
                    dir="auto"
                    className="text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words"
                  >
                    {searchResult.summary}
                  </div>
                </article>
                <div className="p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-3">
                  <h3 className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
                    {t.research.sourcesTitle}
                  </h3>
                  {searchResult.sources.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t.research.noSources}</p>
                  ) : (
                    <ul className="divide-y divide-blue-950/10 dark:divide-blue-400/15">
                      {searchResult.sources.map((src, i) => (
                        <li key={`${src.uri}-${i}`} className="py-2.5 flex items-center justify-between gap-3">
                          <a
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs sm:text-sm font-medium text-[#102A5C] dark:text-blue-300 hover:underline truncate"
                          >
                            {src.title || src.uri}
                          </a>
                          <ExternalLink className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTab === 'browser' ? (
          <section className="space-y-5">
            <div className="p-3.5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-[#EAF0FA]/70 dark:bg-[#132852]/70 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
              {t.research.browserBoundaryNote}
            </div>
            <form
              onSubmit={(e) => void handleInspectPage(e)}
              className="p-4 sm:p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-3"
            >
              <input
                type="url"
                dir="ltr"
                value={inspectUrl}
                onChange={(e) => setInspectUrl(e.target.value)}
                placeholder={t.research.urlPlaceholder}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
              />
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  dir="auto"
                  value={inspectPrompt}
                  onChange={(e) => setInspectPrompt(e.target.value)}
                  placeholder={t.research.inspectPromptPlaceholder}
                  className="flex-1 min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!inspectUrl.trim() || !isOnline || inspectBusy}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 rounded-lg transition-colors whitespace-nowrap"
                >
                  {inspectBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Link2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>{inspectBusy ? t.research.inspecting : t.research.inspectButton}</span>
                </button>
              </div>
            </form>

            {inspectError ? (
              <div className="p-4 rounded-xl border border-red-200 dark:border-red-500/35 bg-red-50 dark:bg-red-950/45 text-xs text-red-800 dark:text-red-200">
                {inspectError}
              </div>
            ) : null}

            {inspectResult ? (
              <article className="p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-3">
                <p className="font-mono text-xs text-[#1E3A8A] dark:text-blue-300 break-all">
                  {inspectResult.url}
                </p>
                <div
                  dir="auto"
                  className="text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words"
                >
                  {inspectResult.analysis}
                </div>
              </article>
            ) : null}
          </section>
        ) : null}

        {activeTab === 'downloads' ? (
          <section className="space-y-5">
            <div className="p-3.5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-[#EAF0FA]/70 dark:bg-[#132852]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
              <span>{t.research.downloadGuideNote}</span>
              {grantedMounts.length === 0 && onConnectFolder ? (
                <button
                  type="button"
                  onClick={() => void onConnectFolder()}
                  className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#102A5C] dark:bg-blue-600 text-white font-medium hover:bg-[#0B1D42] dark:hover:bg-blue-500 shrink-0 whitespace-nowrap"
                >
                  <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.research.connectDownloadsTip}</span>
                </button>
              ) : null}
            </div>

            <form
              onSubmit={(e) => void handleDownloadFile(e)}
              className="p-4 sm:p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-3"
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="url"
                  dir="ltr"
                  value={downloadUrl}
                  onChange={(e) => setDownloadUrl(e.target.value)}
                  placeholder={t.research.downloadUrlPlaceholder}
                  className="flex-1 min-h-[44px] px-3.5 py-2 text-sm font-mono rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                />
                <select
                  aria-label={t.research.videoQualityLabel}
                  value={videoQuality}
                  onChange={(e) => setVideoQuality(e.target.value as VideoQualityOption)}
                  className="min-h-[44px] px-3 py-2 text-xs font-medium rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                >
                  <option value="best">{t.research.qualityBest}</option>
                  <option value="720p">{t.research.quality720p}</option>
                  <option value="480p">{t.research.quality480p}</option>
                  <option value="audio">{t.research.qualityAudio}</option>
                </select>
                <button
                  type="submit"
                  disabled={!downloadUrl.trim() || !isOnline || downloadBusy}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 rounded-lg transition-colors whitespace-nowrap"
                >
                  {downloadBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>{downloadBusy ? t.research.downloading : t.research.downloadButton}</span>
                </button>
              </div>

              <div className="pt-1 border-t border-blue-950/10 dark:border-blue-400/15">
                <button
                  type="button"
                  onClick={() => setShowYoutubeOptions((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E3A8A] dark:text-blue-300 hover:underline py-1"
                >
                  <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{t.research.youtubeOptionsToggle}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      showYoutubeOptions ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {showYoutubeOptions ? (
                  <div className="mt-2.5 p-3.5 rounded-lg bg-[#F8FAFD] dark:bg-[#09142B] border border-blue-900/15 dark:border-blue-400/20 space-y-3">
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {t.research.youtubeOptionsDesc}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-white dark:bg-[#0D1B36] text-xs font-medium text-[#0B1B3B] dark:text-slate-100 hover:bg-[#EAF0FA] dark:hover:bg-[#132852] cursor-pointer">
                        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{t.research.cookiesUploadButton}</span>
                        <input
                          type="file"
                          accept=".txt,text/plain"
                          onChange={(e) => void handleCookiesFileUpload(e)}
                          className="sr-only"
                        />
                      </label>
                      {youtubeCookies ? (
                        <button
                          type="button"
                          onClick={() => setYoutubeCookies('')}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-500/35 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          {t.research.clearCookiesButton}
                        </button>
                      ) : null}
                    </div>
                    <textarea
                      dir="ltr"
                      rows={3}
                      value={youtubeCookies}
                      onChange={(e) => setYoutubeCookies(e.target.value)}
                      placeholder={t.research.cookiesPlaceholder}
                      className="w-full p-2.5 text-xs font-mono rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-white dark:bg-[#0D1B36] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                    />
                    <input
                      type="url"
                      dir="ltr"
                      value={cobaltApiUrl}
                      onChange={(e) => setCobaltApiUrl(e.target.value)}
                      placeholder={t.research.cobaltPlaceholder}
                      className="w-full min-h-[38px] px-3 py-1.5 text-xs font-mono rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-white dark:bg-[#0D1B36] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                ) : null}
              </div>
            </form>

            {downloadError ? (
              <div className="p-4 rounded-xl border border-red-200 dark:border-red-500/35 bg-red-50 dark:bg-red-950/45 text-xs text-red-800 dark:text-red-200">
                {downloadError}
              </div>
            ) : null}
            {downloadSuccess ? (
              <div className="p-4 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-[#EAF0FA] dark:bg-[#132852] text-xs font-mono text-[#0B1B3B] dark:text-blue-100">
                {downloadSuccess}
              </div>
            ) : null}

            <div className="overflow-x-auto border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] rounded-xl">
              {downloads.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  {t.research.downloadHistoryEmpty}
                </p>
              ) : (
                <table className="w-full text-start border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-blue-950/10 dark:border-blue-400/15 bg-[#EFF4FB] dark:bg-[#132852] text-[#102A5C] dark:text-blue-200 font-medium">
                      <th className="py-2.5 px-4 text-start">File</th>
                      <th className="py-2.5 px-4 text-start">MIME</th>
                      <th className="py-2.5 px-4 text-end">Size</th>
                      <th className="py-2.5 px-4 text-end">Saved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-950/10 dark:divide-blue-400/15">
                    {downloads.map((d) => (
                      <tr key={d.id} className="hover:bg-[#F5F8FD] dark:hover:bg-[#132852]/60">
                        <td className="py-2.5 px-4 font-mono text-[#0B1B3B] dark:text-slate-100 max-w-[220px] truncate">
                          {d.filename}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{d.mimeType}</td>
                        <td className="py-2.5 px-4 text-end font-mono tabular-nums text-slate-700 dark:text-slate-200">
                          {formatBytes(d.sizeBytes)}
                        </td>
                        <td className="py-2.5 px-4 text-end font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {formatDateTime(d.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === 'apps' ? (
          <section className="space-y-5">
            <div className="p-4 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-[#EAF0FA]/70 dark:bg-[#132852]/70 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0B1B3B] dark:text-slate-100">
                <Info className="h-4 w-4 text-[#102A5C] dark:text-blue-300 shrink-0" aria-hidden="true" />
                <span>{t.research.appsGuideTitle}</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                {t.research.appsGuideBody}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {t.research.appBoundaryNote}
              </p>
            </div>

            <form
              onSubmit={handleAddApp}
              className="p-4 sm:p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              <input
                type="text"
                dir="auto"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder={t.research.appNamePlaceholder}
                className="min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
              />
              <input
                type="text"
                dir="ltr"
                value={appUri}
                onChange={(e) => setAppUri(e.target.value)}
                placeholder={t.research.appUriPlaceholder}
                className="min-h-[44px] px-3.5 py-2 text-sm font-mono rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!appName.trim() || !appUri.trim()}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 rounded-lg transition-colors whitespace-nowrap"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>{t.research.addAppButton}</span>
              </button>
            </form>

            {appError ? (
              <div className="p-3 rounded-lg border border-red-200 dark:border-red-500/35 bg-red-50 dark:bg-red-950/45 text-xs text-red-800 dark:text-red-200">
                {appError}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#EAF0FA] dark:bg-[#132852] border border-blue-900/10 dark:border-blue-400/20">
                {(
                  [
                    { id: 'all', label: t.research.appsFilterAll },
                    { id: 'app', label: t.research.appsFilterDesktop },
                    { id: 'web', label: t.research.appsFilterWeb },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAppFilter(tab.id)}
                    className={`min-h-[32px] px-3 py-1 text-xs font-medium rounded-md ${
                      appFilter === tab.id
                        ? 'bg-white dark:bg-[#0D1B36] text-[#0B1B3B] dark:text-slate-100 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-[#0B1B3B] dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {onRestoreRecommendedApps ? (
                <button
                  type="button"
                  onClick={onRestoreRecommendedApps}
                  className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-[#102A5C] dark:text-blue-200 hover:bg-[#EAF0FA] dark:hover:bg-[#1A3568]"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.research.restoreDefaultsButton}</span>
                </button>
              ) : null}
            </div>

            <div className="border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] rounded-xl divide-y divide-blue-950/10 dark:divide-blue-400/15">
              {filteredApps.map((app) => (
                <div
                  key={app.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F8FAFD] dark:hover:bg-[#132852]/60"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p dir="auto" className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
                        {app.name}
                      </p>
                      <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                        · {app.category === 'web' ? t.research.appsFilterWeb : t.research.appsFilterDesktop}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">{app.uri}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={app.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        onLogActivity({
                          category: 'security',
                          title: `Launched authorized URI: ${app.name}`,
                          details: app.uri,
                          status: 'success',
                        })
                      }
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 text-white whitespace-nowrap"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t.research.launchButton}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => onRemoveAuthorizedApp(app.id)}
                      aria-label={t.tasks.deleteTask}
                      className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-500/35 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {formatNumber(filteredApps.length)} {t.settings.totalLabel}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
