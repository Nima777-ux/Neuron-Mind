import {
  AlertCircle,
  ArrowRight,
  ArrowUp,
  Bot,
  Calendar,
  Code2,
  Compass,
  Database,
  FolderOpen,
  FolderPlus,
  Globe,
  Loader2,
  Mail,
  MessageSquare,
  Mic,
  MicOff,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Square,
  Trash2,
  Volume2,
  Wallet,
  WifiOff,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { useLanguage } from '../../i18n/languageContext';
import type { ComputerFolderMount } from '../../lib/platform/computerFiles';
import { synthesizeReplySpeech } from '../../services/assistantApi';
import type {
  AgentModuleDescriptor,
  ChatAttachment,
  ChatMessage,
  Conversation,
  NavigationSection,
  SystemReadiness,
} from '../../types/assistant';

interface AssistantWorkspaceProps {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
  onSendMessage: (content: string, attachments?: ChatAttachment[]) => Promise<void>;
  isSending: boolean;
  sendingStatusText?: string | null;
  isOnline: boolean;
  errorMessage: string | null;
  onClearError: () => void;
  readiness: SystemReadiness | null;
  modules: AgentModuleDescriptor[];
  onNavigateSection: (section: NavigationSection) => void;
  computerMounts: ComputerFolderMount[];
  computerFsSupported: boolean;
  onConnectFolder: () => Promise<unknown>;
  onReauthorizeFolder: (id: string) => Promise<void>;
  googleWorkspaceConnected: boolean;
  authUserSignedIn?: boolean;
  onConnectGoogleWorkspace?: () => Promise<unknown>;
}

type WorkspaceViewMode = 'chat' | 'explore' | 'plugins';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_BYTES = 180 * 1024;

function readFileAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx !== -1 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

async function compressImageForVision(
  blob: Blob
): Promise<{ base64Data: string; mimeType: string }> {
  const originalBase64 = await readFileAsBase64(blob);
  const originalMime = blob.type || 'image/png';
  if (blob.size <= 450 * 1024) {
    return { base64Data: originalBase64, mimeType: originalMime };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDim = 1280;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const targetW = Math.max(1, Math.round(img.width * scale));
      const targetH = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ base64Data: originalBase64, mimeType: originalMime });
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      const outMime = originalMime === 'image/png' ? 'image/jpeg' : originalMime;
      const dataUrl = canvas.toDataURL(outMime === 'image/png' ? 'image/png' : 'image/jpeg', 0.86);
      const commaIdx = dataUrl.indexOf(',');
      resolve({
        base64Data: commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : originalBase64,
        mimeType: outMime === 'image/png' ? 'image/png' : 'image/jpeg',
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ base64Data: originalBase64, mimeType: originalMime });
    };
    img.src = objectUrl;
  });
}

function getTimeBucket(isoDate: string): 'today' | 'week' | 'older' {
  const ts = new Date(isoDate).getTime();
  if (Number.isNaN(ts)) return 'older';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= startOfToday) return 'today';
  if (ts >= startOfToday - 6 * 24 * 60 * 60 * 1000) return 'week';
  return 'older';
}

export function AssistantWorkspace({
  conversations,
  activeConversation,
  draft,
  onDraftChange,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onSendMessage,
  isSending,
  sendingStatusText,
  isOnline,
  errorMessage,
  onClearError,
  readiness,
  modules: _modules,
  onNavigateSection,
  computerMounts,
  computerFsSupported,
  onConnectFolder,
  onReauthorizeFolder,
  googleWorkspaceConnected,
  authUserSignedIn = false,
  onConnectGoogleWorkspace,
}: AssistantWorkspaceProps) {
  const { language, t, formatTime, formatNumber } = useLanguage();
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [loadingTtsId, setLoadingTtsId] = useState<string | null>(null);

  const [historyOpen, setHistoryOpen] = useState(true);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('chat');

  const {
    isSupported: voiceSupported,
    isListening,
    isTranscribing,
    voiceError,
    clearVoiceError,
    startListening,
    stopListening,
  } = useVoiceInput(
    language,
    (transcript) => {
      const next = draft.trim() ? `${draft.trim()} ${transcript}` : transcript;
      onDraftChange(next);
      textareaRef.current?.focus();
    },
    { isOnline }
  );

  const handleConnectWorkspace = async () => {
    if (!onConnectGoogleWorkspace) return;
    setLocalError(null);
    try {
      await onConnectGoogleWorkspace();
    } catch (err) {
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      const raw = err instanceof Error ? err.message : 'Unable to connect Gmail and Google Calendar.';
      if (raw.includes('auth/unauthorized-domain')) {
        setLocalError(
          host === '127.0.0.1'
            ? 'Firebase Auth requires http://localhost or the hosted Neuron Mind URL rather than bare 127.0.0.1.'
            : `Domain "${host || 'unknown'}" is not listed in Firebase Auth Authorized Domains. Open the hosted Neuron Mind URL or add it in Firebase Console → Authentication → Settings → Authorized domains.`
        );
      } else {
        setLocalError(raw);
      }
    }
  };

  const messages = activeConversation?.messages ?? [];

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isSending]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [draft]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stopAudioPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setSpeakingMessageId(null);
  };

  const handleSpeakMessage = async (message: ChatMessage) => {
    if (speakingMessageId === message.id) {
      stopAudioPlayback();
      return;
    }
    stopAudioPlayback();
    setLocalError(null);
    setLoadingTtsId(message.id);
    try {
      const { audioBase64, mimeType } = await synthesizeReplySpeech(
        message.content,
        message.language ?? language
      );
      const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
      audioRef.current = audio;
      setSpeakingMessageId(message.id);
      audio.onended = () => {
        setSpeakingMessageId(null);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setSpeakingMessageId(null);
        audioRef.current = null;
      };
      await audio.play();
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Unable to synthesize audio playback.'
      );
      setSpeakingMessageId(null);
    } finally {
      setLoadingTtsId(null);
    }
  };

  const appendImageBlob = async (blob: Blob, name: string) => {
    if (blob.size > MAX_IMAGE_BYTES) {
      setLocalError('Image must be smaller than 5 MB.');
      return;
    }
    const { base64Data, mimeType } = await compressImageForVision(blob);
    setAttachments((prev) => [
      ...prev.slice(-3),
      {
        name,
        mimeType,
        base64Data,
        kind: 'image',
      },
    ]);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setLocalError(null);
    try {
      for (const file of Array.from(fileList)) {
        if (file.type.startsWith('image/')) {
          await appendImageBlob(file, file.name);
        } else {
          const slice = file.size > MAX_TEXT_BYTES ? file.slice(0, MAX_TEXT_BYTES) : file;
          const textContent = await slice.text();
          setAttachments((prev) => [
            ...prev.slice(-3),
            {
              name: file.name,
              mimeType: file.type || 'text/plain',
              textContent,
              kind: 'text',
            },
          ]);
        }
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to attach file.');
    } finally {
      e.target.value = '';
    }
  };

  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) {
          e.preventDefault();
          await appendImageBlob(blob, `pasted-${Date.now()}.png`);
        }
      }
    }
  };

  const triggerSend = async () => {
    const trimmed = draft.trim();
    if ((!trimmed && attachments.length === 0) || isSending) return;
    setViewMode('chat');
    const outboundText =
      trimmed || (language === 'fa' ? 'این پیوست را تحلیل کن.' : 'Analyze this attachment.');
    const outboundAttachments = attachments.length > 0 ? [...attachments] : undefined;
    setAttachments([]);
    await onSendMessage(outboundText, outboundAttachments);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await triggerSend();
  };

  const handleKeyDown = async (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await triggerSend();
    }
  };

  const launchPrompt = (promptText: string) => {
    onDraftChange(promptText);
    setViewMode('chat');
    setMobileHistoryOpen(false);
    textareaRef.current?.focus();
  };

  const geminiConfigured = readiness?.gemini.configured ?? true;
  const grantedMounts = computerMounts.filter((m) => m.permission === 'granted');
  const promptMounts = computerMounts.filter((m) => m.permission === 'prompt');

  const sortedFilteredConversations = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return [...conversations]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .filter((c) => {
        if (!q) return true;
        if (c.title.toLowerCase().includes(q)) return true;
        return c.messages.some((m) => m.content.toLowerCase().includes(q));
      });
  }, [conversations, historySearch]);

  const groupedHistory = useMemo(() => {
    const today: Conversation[] = [];
    const week: Conversation[] = [];
    const older: Conversation[] = [];
    for (const conv of sortedFilteredConversations) {
      const bucket = getTimeBucket(conv.updatedAt || conv.createdAt);
      if (bucket === 'today') today.push(conv);
      else if (bucket === 'week') week.push(conv);
      else older.push(conv);
    }
    return [
      { key: 'today', label: t.chat.historyToday, items: today },
      { key: 'week', label: t.chat.historyWeek, items: week },
      { key: 'older', label: t.chat.historyOlder, items: older },
    ].filter((g) => g.items.length > 0);
  }, [sortedFilteredConversations, t.chat.historyToday, t.chat.historyWeek, t.chat.historyOlder]);

  const exploreCatalog = useMemo(
    () =>
      language === 'fa'
        ? [
            {
              title: 'فایل‌ها و کامپیوتر',
              icon: FolderOpen,
              section: 'files' as NavigationSection,
              desc: 'لیست، جستجو، خواندن، مقایسه، تغییر نام، جابه‌جایی، حذف با تایید، دسته‌بندی رسانه و پشتیبان‌گیری ZIP/JSON.',
              prompt: 'پوشه‌های متصل کامپیوتر من را بررسی کن و فایل‌ها را مرتب و خلاصه کن.',
            },
            {
              title: 'ایمیل جیمیل و تقویم',
              icon: Mail,
              section: 'emails' as NavigationSection,
              desc: 'خواندن و جستجوی جیمیل، خلاصه‌سازی پیام‌ها، ساخت پیش‌نویس، ارسال ایمیل با تایید شما و همگام‌سازی تقویم گوگل.',
              prompt: 'ایمیل‌های خوانده‌نشده جیمیل را بررسی کن و رویدادهای پیش‌روی تقویم را هم بیاور.',
            },
            {
              title: 'وظایف، یادآور و برنامه روزانه',
              icon: Calendar,
              section: 'tasks' as NavigationSection,
              desc: 'ساخت وظیفه، تنظیم یادآور تکرارشونده و تولید برنامه زمان‌بندی روزانه به فارسی یا انگلیسی.',
              prompt: 'برای امروز یک برنامه روزانه هوشمند با اولویت‌بندی کارهایم بساز.',
            },
            {
              title: 'تحقیق زنده وب و دانلود',
              icon: Globe,
              section: 'research' as NavigationSection,
              desc: 'جستجوی زنده در وب همراه با لینک منبع، تحلیل صفحات وب و دانلود امن فایل‌ها.',
              prompt: 'آخرین اخبار هوش مصنوعی و راندمان برنامه‌نویسی را در وب جستجو و خلاصه کن.',
            },
            {
              title: 'کدنویسی، گیت و دیتابیس',
              icon: Code2,
              section: 'workbench' as NavigationSection,
              desc: 'ساخت اسکلت پروژه نرم‌افزاری، بررسی تاریخچه Git در پوشه متصل و ساخت/جستجوی جداول داده.',
              prompt: 'یک پروژه نمونه Node.js TypeScript بساز یا وضعیت مخزن گیت پوشه‌ام را بررسی کن.',
            },
            {
              title: 'صوت جلسات، مالی و گاوصندوق',
              icon: Wallet,
              section: 'hub' as NavigationSection,
              desc: 'تبدیل صوت جلسه به متن و وظیفه، ثبت درآمد و هزینه، خواندن صوتی پاسخ و گاوصندوق رمزنگاری‌شده AES-GCM.',
              prompt: 'گزارش خلاصه مالی من و آخرین تاریخچه فعالیت‌ها را نمایش بده.',
            },
          ]
        : [
            {
              title: 'Computer & Files',
              icon: FolderOpen,
              section: 'files' as NavigationSection,
              desc: 'List, read, compare, create, rename, move, confirm-delete PC files, sort media, and export ZIP/JSON backups.',
              prompt: 'List my connected computer folders and summarize or organize my files.',
            },
            {
              title: 'Gmail & Google Calendar',
              icon: Mail,
              section: 'emails' as NavigationSection,
              desc: 'Read & search real Gmail inbox, summarize threads, save drafts, confirm-send replies, and sync Google Calendar.',
              prompt: 'Check my unread Gmail messages, summarize them, and list upcoming Google Calendar events.',
            },
            {
              title: 'Tasks, Reminders & Daily Plan',
              icon: Calendar,
              section: 'tasks' as NavigationSection,
              desc: 'Create bilingual tasks, set one-time/recurring reminders, and generate prioritized daily time-blocked schedules.',
              prompt: 'Review my open tasks and generate a prioritized daily plan for today.',
            },
            {
              title: 'Live Web Research & Downloads',
              icon: Globe,
              section: 'research' as NavigationSection,
              desc: 'Search live websites with source citations, inspect public URLs, download permitted files, and open authorized links.',
              prompt: 'Search the web for current TypeScript best practices and create a short summary report.',
            },
            {
              title: 'Code, Git & Database Tables',
              icon: Code2,
              section: 'workbench' as NavigationSection,
              desc: 'Scaffold multi-file Node/React/Python projects, inspect local Git metadata, and query structured database tables.',
              prompt: 'Inspect the Git repository metadata in my connected folder or help me create a project table.',
            },
            {
              title: 'Meetings Audio, Finance & Vault',
              icon: Wallet,
              section: 'hub' as NavigationSection,
              desc: 'Transcribe meeting audio into tasks, log expenses/income, analyze uploaded images/files in chat, and track audit logs.',
              prompt: 'Show my financial summary across currencies and check recent activity history.',
            },
          ],
    [language]
  );

  const pluginsList = useMemo(
    () => [
      {
        id: 'gmail',
        name: language === 'fa' ? 'پلاگین جیمیل (Gmail)' : 'Gmail Connector',
        connected: googleWorkspaceConnected && isOnline,
        section: 'emails' as NavigationSection,
        icon: Mail,
        tools: 'check_emails · read_email_detail · create_email_draft · prepare_send_email',
        prompt: language === 'fa' ? 'ایمیل‌های خوانده‌نشده من را بررسی کن.' : 'Check my unread Gmail messages.',
      },
      {
        id: 'calendar',
        name: language === 'fa' ? 'پلاگین تقویم گوگل' : 'Google Calendar Sync',
        connected: googleWorkspaceConnected && isOnline,
        section: 'calendar' as NavigationSection,
        icon: Calendar,
        tools: 'list_google_calendar_events · create_calendar_event · list_calendar_events',
        prompt: language === 'fa' ? 'رویدادهای تقویم گوگل من را نمایش بده.' : 'Show my upcoming Google Calendar events.',
      },
      {
        id: 'computer-fs',
        name: language === 'fa' ? 'دسترسی پوشه‌های کامپیوتر' : 'Computer File System',
        connected: grantedMounts.length > 0,
        section: 'files' as NavigationSection,
        icon: FolderOpen,
        tools: 'list_computer_directory · read/write/move/copy/compare · organize_media_files',
        prompt: language === 'fa' ? 'فایل‌های داخل پوشه متصل کامپیوترم را لیست کن.' : 'List files in my connected computer folder.',
      },
      {
        id: 'web-research',
        name: language === 'fa' ? 'جستجو و مرورگر وب' : 'Live Web Search & Reader',
        connected: isOnline && geminiConfigured,
        section: 'research' as NavigationSection,
        icon: Globe,
        tools: 'web_research · inspect_webpage · download_from_url · launch_authorized_app_or_url',
        prompt: language === 'fa' ? 'جستجو در وب درباره وضعیت بازار فناوری' : 'Search the web for latest web performance tips.',
      },
      {
        id: 'dev-tools',
        name: language === 'fa' ? 'ابزار توسعه، گیت و دیتابیس' : 'Code, Git & Data Tables',
        connected: true,
        section: 'workbench' as NavigationSection,
        icon: Database,
        tools: 'inspect_git_repository · scaffold_software_project · create/insert/query_data_table',
        prompt: language === 'fa' ? 'جداول پایگاه‌داده من را نمایش بده.' : 'Query my existing structured database tables.',
      },
      {
        id: 'system-clipboard-backup',
        name: language === 'fa' ? 'سیستم، کلیپ‌بورد و پشتیبان‌گیری' : 'System, Clipboard & Backups',
        connected: true,
        section: 'settings' as NavigationSection,
        icon: Shield,
        tools: 'get_system_metrics · save/list_clipboard_entry · create_workspace_backup',
        prompt: language === 'fa' ? 'وضعیت حافظه و پردازنده سیستم را بررسی کن.' : 'Check my system metrics and storage quota.',
      },
    ],
    [language, googleWorkspaceConnected, isOnline, grantedMounts.length, geminiConfigured]
  );

  const renderHistorySidebarContent = () => (
    <div className="h-full flex flex-col bg-white dark:bg-[#0D1B36]">
      <div className="p-3 space-y-2 border-b border-blue-950/10 dark:border-blue-400/15">
        <button
          type="button"
          onClick={() => {
            onNewConversation();
            setViewMode('chat');
            setMobileHistoryOpen(false);
          }}
          className="w-full min-h-[40px] flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg bg-[#102A5C] dark:bg-blue-600 text-white hover:bg-[#0B1D42] dark:hover:bg-blue-500 transition-colors"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{t.chat.newChat}</span>
        </button>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => {
              setViewMode((prev) => (prev === 'explore' ? 'chat' : 'explore'));
              setMobileHistoryOpen(false);
            }}
            className={`min-h-[36px] flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              viewMode === 'explore'
                ? 'bg-[#EAF0FA] dark:bg-[#162F61] text-[#0B1B3B] dark:text-white border-[#102A5C]/30 dark:border-blue-400/40 font-semibold'
                : 'bg-[#F8FAFD] dark:bg-[#09142B] text-slate-700 dark:text-slate-300 border-blue-900/15 dark:border-blue-400/20 hover:bg-[#EAF0FA] dark:hover:bg-[#132852]'
            }`}
          >
            <Compass className="h-3.5 w-3.5 text-[#102A5C] dark:text-blue-300" aria-hidden="true" />
            <span className="truncate">{t.chat.explore}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode((prev) => (prev === 'plugins' ? 'chat' : 'plugins'));
              setMobileHistoryOpen(false);
            }}
            className={`min-h-[36px] flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              viewMode === 'plugins'
                ? 'bg-[#EAF0FA] dark:bg-[#162F61] text-[#0B1B3B] dark:text-white border-[#102A5C]/30 dark:border-blue-400/40 font-semibold'
                : 'bg-[#F8FAFD] dark:bg-[#09142B] text-slate-700 dark:text-slate-300 border-blue-900/15 dark:border-blue-400/20 hover:bg-[#EAF0FA] dark:hover:bg-[#132852]'
            }`}
          >
            <Plug className="h-3.5 w-3.5 text-[#102A5C] dark:text-blue-300" aria-hidden="true" />
            <span className="truncate">{t.chat.plugins}</span>
          </button>
        </div>

        <div className="relative">
          <Search
            className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 absolute top-1/2 -translate-y-1/2 start-2.5"
            aria-hidden="true"
          />
          <input
            type="text"
            dir="auto"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            placeholder={t.chat.searchChatsPlaceholder}
            className="w-full min-h-[34px] ps-8 pe-2.5 py-1 text-xs rounded-lg border border-blue-900/15 dark:border-blue-400/20 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
        {groupedHistory.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            {t.chat.noMatchingChats}
          </p>
        ) : (
          groupedHistory.map((group) => (
            <div key={group.key} className="space-y-1">
              <p className="px-2 pt-1 text-[11px] font-semibold text-[#1E3A8A]/70 dark:text-blue-300/75">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((conv) => {
                  const selected =
                    viewMode === 'chat' && conv.id === activeConversation?.id;
                  return (
                    <li key={conv.id} className="group flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectConversation(conv.id);
                          setViewMode('chat');
                          setMobileHistoryOpen(false);
                        }}
                        className={`flex-1 min-w-0 min-h-[36px] flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-start transition-colors border ${
                          selected
                            ? 'bg-[#EAF0FA] dark:bg-[#162F61] text-[#0B1B3B] dark:text-white font-semibold border-[#102A5C]/25 dark:border-blue-400/35'
                            : 'text-slate-700 dark:text-slate-300 border-transparent hover:bg-[#F8FAFD] dark:hover:bg-[#132852]/70 hover:text-[#0B1B3B] dark:hover:text-white'
                        }`}
                      >
                        <MessageSquare
                          className={`h-3.5 w-3.5 shrink-0 ${
                            selected ? 'text-[#102A5C] dark:text-blue-300' : 'text-slate-400 dark:text-slate-500'
                          }`}
                          aria-hidden="true"
                        />
                        <span dir="auto" className="truncate flex-1">
                          {conv.title}
                        </span>
                        <span className="font-mono tabular-nums text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                          {formatNumber(conv.messages.length)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteConversation(conv.id)}
                        aria-label={t.chat.deleteChat}
                        title={t.chat.deleteChat}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded text-slate-400 dark:text-slate-500 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/60 transition-opacity shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex bg-[#F8FAFD] dark:bg-[#071126] relative overflow-hidden">
      {historyOpen ? (
        <aside className="hidden md:flex w-[256px] shrink-0 border-e border-blue-950/12 dark:border-blue-400/15 h-full flex-col">
          {renderHistorySidebarContent()}
        </aside>
      ) : null}

      {mobileHistoryOpen ? (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div
            className="fixed inset-0 bg-[#061024]/45 dark:bg-black/65"
            onClick={() => setMobileHistoryOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-50 w-[264px] max-w-[82vw] h-full bg-white dark:bg-[#0D1B36] border-e border-blue-950/15 dark:border-blue-400/20 flex flex-col">
            <div className="px-3 py-2.5 border-b border-blue-950/10 dark:border-blue-400/15 flex items-center justify-between">
              <span className="text-xs font-semibold text-[#0B1B3B] dark:text-slate-100">
                {t.chat.toggleHistory}
              </span>
              <button
                type="button"
                onClick={() => setMobileHistoryOpen(false)}
                className="p-1 text-slate-500 dark:text-slate-400 hover:text-[#0B1B3B] dark:hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 min-h-0">{renderHistorySidebarContent()}</div>
          </aside>
        </div>
      ) : null}

      <div className="flex-1 min-w-0 flex flex-col h-full">
        <div className="shrink-0 border-b border-blue-950/10 dark:border-blue-400/15 bg-white dark:bg-[#0D1B36] px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setHistoryOpen((prev) => !prev)}
              aria-label={t.chat.toggleHistory}
              title={t.chat.toggleHistory}
              className="hidden md:inline-flex min-h-[30px] items-center gap-1.5 px-2.5 py-1 rounded-md border border-blue-900/15 dark:border-blue-400/20 bg-[#F8FAFD] dark:bg-[#09142B] hover:bg-[#EAF0FA] dark:hover:bg-[#132852] text-[#102A5C] dark:text-blue-300 font-medium"
            >
              {historyOpen ? (
                <PanelLeftClose className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{t.chat.toggleHistory}</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileHistoryOpen(true)}
              className="md:hidden inline-flex min-h-[30px] items-center gap-1.5 px-2.5 py-1 rounded-md border border-blue-900/15 dark:border-blue-400/20 bg-[#F8FAFD] dark:bg-[#09142B] text-[#102A5C] dark:text-blue-300 font-medium"
            >
              <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.chat.toggleHistory}</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 text-slate-600 dark:text-slate-300 border-s border-blue-900/15 dark:border-blue-400/20 ps-2">
              <FolderOpen className="h-3.5 w-3.5 text-[#102A5C] dark:text-blue-300 shrink-0" aria-hidden="true" />
              <span className="font-medium text-[#0B1B3B] dark:text-slate-100 whitespace-nowrap">
                {t.chat.computerFoldersLabel}
              </span>
              {grantedMounts.length > 0 ? (
                <span className="text-[#102A5C] dark:text-blue-300 font-medium truncate max-w-[160px]">
                  {grantedMounts.map((m) => m.name).join(' · ')}
                </span>
              ) : (
                <span className="text-slate-500 dark:text-slate-400">{t.chat.noFoldersQuick}</span>
              )}
              {promptMounts.map((mount) => (
                <button
                  key={mount.id}
                  type="button"
                  onClick={() => void onReauthorizeFolder(mount.id)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 font-medium hover:bg-amber-100 dark:hover:bg-amber-900/60 whitespace-nowrap"
                >
                  <RefreshCw className="h-3 w-3" aria-hidden="true" />
                  <span>
                    {mount.name} ({t.files.reconnectFolder})
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {viewMode !== 'chat' ? (
              <button
                type="button"
                onClick={() => setViewMode('chat')}
                className="min-h-[30px] inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#102A5C] dark:bg-blue-600 text-white font-medium"
              >
                <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.chat.backToChat}</span>
              </button>
            ) : null}
            {computerFsSupported ? (
              <button
                type="button"
                onClick={() => void onConnectFolder()}
                className="min-h-[30px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-blue-900/20 dark:border-blue-400/25 bg-[#EFF4FB] dark:bg-[#132852] hover:bg-[#E1EAF8] dark:hover:bg-[#1A3568] text-[#102A5C] dark:text-blue-200 font-medium whitespace-nowrap transition-colors"
              >
                <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.chat.connectFolderQuick}</span>
              </button>
            ) : null}
            {onConnectGoogleWorkspace ? (
              googleWorkspaceConnected ? (
                <span className="hidden md:inline-flex min-h-[30px] items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-500/35 bg-emerald-50 dark:bg-emerald-950/45 text-emerald-900 dark:text-emerald-200 font-medium whitespace-nowrap">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.auth.workspaceSessionActive}</span>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={!isOnline}
                  onClick={() => void handleConnectWorkspace()}
                  className="min-h-[30px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-blue-900/20 dark:border-blue-400/25 bg-white dark:bg-[#09142B] hover:bg-[#EAF0FA] dark:hover:bg-[#132852] text-[#102A5C] dark:text-blue-200 disabled:opacity-50 font-medium whitespace-nowrap transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.auth.connectWorkspaceQuick}</span>
                </button>
              )
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 flex flex-col">
          <div
            className={`max-w-3xl w-full mx-auto ${
              viewMode === 'chat' && messages.length === 0
                ? 'flex-1 flex flex-col'
                : ''
            }`}
          >
            {!isOnline ? (
              <div
                role="status"
                className="mb-6 p-4 rounded-xl border border-amber-300 dark:border-amber-500/35 bg-amber-50 dark:bg-amber-950/45 flex items-start gap-3"
              >
                <WifiOff
                  className="h-5 w-5 text-amber-800 dark:text-amber-300 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-amber-950 dark:text-amber-100">{t.offline.bannerTitle}</p>
                  <p className="text-amber-900 dark:text-amber-200">{t.offline.aiUnavailableOffline}</p>
                </div>
              </div>
            ) : null}

            {!geminiConfigured ? (
              <div
                role="status"
                className="mb-6 p-4 rounded-xl border border-amber-200 dark:border-amber-500/35 bg-amber-50/80 dark:bg-amber-950/45 flex items-start gap-3"
              >
                <AlertCircle
                  className="h-5 w-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="text-sm text-slate-800 dark:text-amber-100 space-y-1">
                  <p className="font-medium text-slate-900 dark:text-white">{t.chat.geminiKeyTitle}</p>
                  <p className="text-slate-600 dark:text-amber-200/90">{t.chat.geminiKeyBody}</p>
                </div>
              </div>
            ) : null}

            {viewMode === 'explore' ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="font-display text-2xl font-semibold text-[#0B1B3B] dark:text-slate-100">
                    {t.chat.exploreTitle}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {t.chat.exploreSubtitle}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {exploreCatalog.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.title}
                        className="p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[#102A5C] dark:text-blue-300">
                            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <h3 className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
                              {item.title}
                            </h3>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-blue-900/10 dark:border-blue-400/15">
                          <button
                            type="button"
                            onClick={() => launchPrompt(item.prompt)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#102A5C] dark:text-blue-300 hover:underline"
                          >
                            <span>{t.chat.tryPrompt}</span>
                            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigateSection(item.section)}
                            className="text-xs text-slate-500 dark:text-slate-400 hover:text-[#0B1B3B] dark:hover:text-white"
                          >
                            {t.chat.openModule}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : viewMode === 'plugins' ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="font-display text-2xl font-semibold text-[#0B1B3B] dark:text-slate-100">
                    {t.chat.pluginsTitle}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {t.chat.pluginsSubtitle}
                  </p>
                </div>
                <ul className="divide-y divide-blue-950/10 dark:divide-blue-400/15 border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] rounded-xl overflow-hidden">
                  {pluginsList.map((plugin) => {
                    const Icon = plugin.icon;
                    return (
                      <li
                        key={plugin.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-[#102A5C] dark:text-blue-300 shrink-0" aria-hidden="true" />
                            <p className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
                              {plugin.name}
                            </p>
                            <span
                              className={`text-[11px] font-medium ${
                                plugin.connected ? 'text-[#102A5C] dark:text-blue-300' : 'text-amber-800 dark:text-amber-300'
                              }`}
                            >
                              · {plugin.connected ? t.chat.pluginActive : t.chat.pluginNeedsConnect}
                            </span>
                          </div>
                          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                            {plugin.tools}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => launchPrompt(plugin.prompt)}
                            className="min-h-[34px] px-3 py-1 text-xs font-medium rounded-lg bg-[#EAF0FA] dark:bg-[#132852] text-[#102A5C] dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-[#1A3568]"
                          >
                            {t.chat.tryPrompt}
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigateSection(plugin.section)}
                            className="min-h-[34px] px-3 py-1 text-xs font-medium rounded-lg border border-blue-900/15 dark:border-blue-400/20 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#132852]"
                          >
                            {t.chat.openModule}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8">
                <div className="w-full space-y-6">
                  <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#0B1B3B] dark:text-slate-100 text-center text-balance">
                    {t.chat.emptyPromptTitle}
                  </h2>

                  <form onSubmit={handleSubmit} className="w-full">
                    {attachments.length > 0 ? (
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {attachments.map((att, idx) => (
                          <div
                            key={`${att.name}-${idx}`}
                            className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-blue-900/20 dark:border-blue-400/25 bg-[#EFF4FB] dark:bg-[#132852] text-xs text-[#0B1B3B] dark:text-slate-100"
                          >
                            {att.kind === 'image' && att.base64Data ? (
                              <img
                                src={`data:${att.mimeType};base64,${att.base64Data}`}
                                alt={att.name}
                                className="h-7 w-7 rounded object-cover border border-blue-900/15 dark:border-blue-400/25 shrink-0"
                              />
                            ) : null}
                            <span className="font-mono truncate max-w-[180px]">
                              {att.name}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setAttachments((prev) => prev.filter((_, i) => i !== idx))
                              }
                              aria-label={t.chat.removeAttachment}
                              className="text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-300"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.txt,.md,.json,.csv,.ts,.tsx,.js,.py,.html,.css"
                      onChange={(e) => void handleFileChange(e)}
                      className="sr-only"
                    />

                    <div className="flex items-end gap-2 p-2.5 rounded-2xl border border-blue-900/20 dark:border-blue-400/25 bg-white dark:bg-[#0D1B36] shadow-xs focus-within:border-[#102A5C] dark:focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-[#102A5C]/15 dark:focus-within:ring-blue-400/20 transition-colors duration-150">
                      <label htmlFor="assistant-composer-empty" className="sr-only">
                        {t.chat.composerLabel}
                      </label>
                      <textarea
                        id="assistant-composer-empty"
                        ref={textareaRef}
                        rows={1}
                        dir="auto"
                        value={draft}
                        onChange={(e) => onDraftChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={(e) => void handlePaste(e)}
                        placeholder={
                          isOnline
                            ? t.chat.composerPlaceholder
                            : t.chat.composerPlaceholderOffline
                        }
                        disabled={isSending}
                        className="flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none disabled:opacity-60 max-h-[180px]"
                      />

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSending || !isOnline}
                        aria-label={t.chat.attachFileOrImage}
                        title={t.chat.attachFileOrImage}
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#102A5C] dark:text-blue-300 hover:bg-[#EAF0FA] dark:hover:bg-[#132852] disabled:opacity-40 transition-colors duration-150 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#102A5C]"
                      >
                        <Paperclip className="h-4 w-4" aria-hidden="true" />
                      </button>

                      {voiceSupported ? (
                        <button
                          type="button"
                          onClick={
                            isListening ? stopListening : () => void startListening()
                          }
                          disabled={isSending || isTranscribing}
                          aria-label={isListening ? t.chat.voiceStop : t.chat.voiceStart}
                          title={isListening ? t.chat.voiceStop : t.chat.voiceStart}
                          className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border transition-colors duration-150 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#102A5C] ${
                            isListening
                              ? 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-500/45 text-red-700 dark:text-red-300'
                              : 'bg-[#F8FAFD] dark:bg-[#09142B] border-blue-900/20 dark:border-blue-400/25 text-[#102A5C] dark:text-blue-300 hover:bg-[#EAF0FA] dark:hover:bg-[#132852] disabled:opacity-40'
                          }`}
                        >
                          {isTranscribing ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : isListening ? (
                            <MicOff className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Mic className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      ) : null}

                      <button
                        type="submit"
                        disabled={(!draft.trim() && attachments.length === 0) || isSending}
                        aria-label={t.chat.send}
                        className="min-h-[44px] min-w-[44px] px-3.5 py-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 text-white text-sm font-medium transition-colors duration-150 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#102A5C] focus-visible:ring-offset-2"
                      >
                        {isSending ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <ArrowUp className="h-4 w-4" aria-hidden="true" />
                        )}
                        <span className="hidden sm:inline">{t.chat.send}</span>
                      </button>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 min-h-[18px]">
                      <span>{t.chat.composerHint}</span>
                      {isListening || isTranscribing ? (
                        <span className="text-[#102A5C] dark:text-blue-300 font-medium">
                          {isTranscribing ? t.chat.voiceTranscribing : t.chat.voiceListening}
                        </span>
                      ) : null}
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => {
                  const isUser = message.role === 'user';
                  const msgDir = message.language === 'fa' ? 'rtl' : 'ltr';
                  const isSpeaking = speakingMessageId === message.id;
                  const isLoadingAudio = loadingTtsId === message.id;

                  return (
                    <article
                      key={message.id}
                      dir={msgDir}
                      className={`p-5 rounded-xl border ${
                        isUser
                          ? 'bg-[#EAF0FA] dark:bg-[#132852] border-blue-900/15 dark:border-blue-400/25'
                          : 'bg-white dark:bg-[#0D1B36] border-blue-950/10 dark:border-blue-400/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span
                            className={`font-semibold ${
                              isUser ? 'text-[#0B1B3B] dark:text-white' : 'text-[#102A5C] dark:text-blue-300'
                            }`}
                          >
                            {isUser ? t.chat.you : t.chat.assistantName}
                          </span>
                          {message.model ? (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono text-slate-500 dark:text-slate-400">{message.model}</span>
                            </>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          {!isUser && isOnline && message.content.trim() ? (
                            <button
                              type="button"
                              onClick={() => void handleSpeakMessage(message)}
                              disabled={isLoadingAudio}
                              aria-label={isSpeaking ? t.chat.stopSpeaking : t.chat.speakReply}
                              title={isSpeaking ? t.chat.stopSpeaking : t.chat.speakReply}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-blue-900/15 dark:border-blue-400/20 bg-[#F8FAFD] dark:bg-[#09142B] hover:bg-[#EAF0FA] dark:hover:bg-[#132852] text-xs font-medium text-[#102A5C] dark:text-blue-300 disabled:opacity-50"
                            >
                              {isLoadingAudio ? (
                                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                              ) : isSpeaking ? (
                                <Square className="h-3 w-3" aria-hidden="true" />
                              ) : (
                                <Volume2 className="h-3 w-3" aria-hidden="true" />
                              )}
                              <span>{isSpeaking ? t.chat.stopSpeaking : t.chat.speakReply}</span>
                            </button>
                          ) : null}
                          <time
                            dateTime={message.createdAt}
                            className="font-mono tabular-nums text-xs text-slate-400 dark:text-slate-500"
                          >
                            {formatTime(message.createdAt)}
                          </time>
                        </div>
                      </div>

                      <div className="text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words text-start">
                        {message.content}
                      </div>

                      {message.attachmentPreviews && message.attachmentPreviews.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.attachmentPreviews.map((preview, idx) => (
                            <img
                              key={`${preview.name}-${idx}`}
                              src={preview.dataUrl}
                              alt={preview.name}
                              className="max-h-52 max-w-full rounded-lg border border-blue-900/15 dark:border-blue-400/25 object-contain bg-white dark:bg-[#09142B]"
                            />
                          ))}
                        </div>
                      ) : null}

                      {message.attachmentNames && message.attachmentNames.length > 0 ? (
                        <p className="mt-2 pt-2 border-t border-blue-900/10 dark:border-blue-400/15 text-xs font-mono text-slate-600 dark:text-slate-300">
                          {t.chat.attachmentsLabel} {message.attachmentNames.join(', ')}
                        </p>
                      ) : null}

                      {message.toolActions && message.toolActions.length > 0 ? (
                        <p className="mt-3 pt-2 border-t border-blue-950/10 dark:border-blue-400/15 text-xs text-[#1E3A8A]/80 dark:text-blue-300/80 font-mono">
                          {t.chat.toolExecutedPrefix} {message.toolActions.join(', ')}
                        </p>
                      ) : null}
                    </article>
                  );
                })}

                {!googleWorkspaceConnected &&
                onConnectGoogleWorkspace &&
                isOnline &&
                (authUserSignedIn ||
                  messages.some(
                    (m) =>
                      m.role === 'assistant' &&
                      /not connected|متصل نشده|Connect Gmail/i.test(m.content)
                  )) ? (
                  <div className="p-4 rounded-xl border border-blue-900/20 dark:border-blue-400/25 bg-[#EAF0FA] dark:bg-[#132852] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5 text-xs text-[#0B1B3B] dark:text-slate-100">
                      <Mail className="h-4 w-4 text-[#102A5C] dark:text-blue-300 shrink-0 mt-0.5" aria-hidden="true" />
                      <p className="leading-relaxed">{t.auth.workspaceNeedsRefresh}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleConnectWorkspace()}
                      className="min-h-[36px] inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 text-white shrink-0 whitespace-nowrap"
                    >
                      <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t.auth.connectWorkspaceQuick}</span>
                    </button>
                  </div>
                ) : null}

                {isSending ? (
                  <div className="p-4 rounded-xl bg-white dark:bg-[#0D1B36] border border-blue-950/10 dark:border-blue-400/20 flex items-center gap-2.5 text-sm text-[#102A5C] dark:text-blue-300">
                    <Loader2 className="h-4 w-4 animate-spin text-[#102A5C] dark:text-blue-300" aria-hidden="true" />
                    <span>{sendingStatusText || t.chat.thinking}</span>
                  </div>
                ) : null}
              </div>
            )}

            {errorMessage || voiceError || localError ? (
              <div
                role="alert"
                className="mt-4 p-4 rounded-xl border border-red-200 dark:border-red-500/35 bg-red-50 dark:bg-red-950/45 flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle
                    className="h-5 w-5 text-red-700 dark:text-red-300 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div className="text-sm">
                    <p className="font-medium text-red-900 dark:text-red-100">{t.chat.requestErrorTitle}</p>
                    <p className="text-red-800 dark:text-red-200 mt-0.5">
                      {errorMessage ||
                        localError ||
                        (voiceError === 'UNSUPPORTED'
                          ? t.chat.voiceUnsupported
                          : voiceError === 'ERROR'
                          ? t.chat.voiceError
                          : voiceError)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClearError();
                    clearVoiceError();
                    setLocalError(null);
                  }}
                  className="min-h-[32px] px-2.5 py-1 text-xs font-medium text-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                >
                  {t.chat.dismiss}
                </button>
              </div>
            ) : null}

            <div ref={scrollAnchorRef} />
          </div>
        </div>

        {viewMode !== 'chat' || messages.length > 0 ? (
          <div className="shrink-0 border-t border-blue-950/12 dark:border-blue-400/15 bg-white dark:bg-[#0D1B36] px-4 lg:px-8 py-4">
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
              {attachments.length > 0 ? (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {attachments.map((att, idx) => (
                    <div
                      key={`${att.name}-${idx}`}
                      className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-blue-900/20 dark:border-blue-400/25 bg-[#EFF4FB] dark:bg-[#132852] text-xs text-[#0B1B3B] dark:text-slate-100"
                    >
                      {att.kind === 'image' && att.base64Data ? (
                        <img
                          src={`data:${att.mimeType};base64,${att.base64Data}`}
                          alt={att.name}
                          className="h-7 w-7 rounded object-cover border border-blue-900/15 dark:border-blue-400/25 shrink-0"
                        />
                      ) : null}
                      <span className="font-mono truncate max-w-[180px]">{att.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((prev) => prev.filter((_, i) => i !== idx))
                        }
                        aria-label={t.chat.removeAttachment}
                        className="text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-300"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.txt,.md,.json,.csv,.ts,.tsx,.js,.py,.html,.css"
                onChange={(e) => void handleFileChange(e)}
                className="sr-only"
              />

              <div className="flex items-end gap-2 p-2 rounded-xl border border-blue-900/25 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] focus-within:bg-white dark:focus-within:bg-[#0B1834] focus-within:border-[#102A5C] dark:focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-[#102A5C]/15 dark:focus-within:ring-blue-400/20 transition-colors duration-150">
                <label htmlFor="assistant-composer" className="sr-only">
                  {t.chat.composerLabel}
                </label>
                <textarea
                  id="assistant-composer"
                  ref={textareaRef}
                  rows={1}
                  dir="auto"
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={(e) => void handlePaste(e)}
                  placeholder={
                    isOnline ? t.chat.composerPlaceholder : t.chat.composerPlaceholderOffline
                  }
                  disabled={isSending}
                  className="flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none disabled:opacity-60 max-h-[180px]"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending || !isOnline}
                  aria-label={t.chat.attachFileOrImage}
                  title={t.chat.attachFileOrImage}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-white dark:bg-[#0D1B36] text-[#102A5C] dark:text-blue-300 hover:bg-[#EAF0FA] dark:hover:bg-[#132852] disabled:opacity-40 transition-colors duration-150 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#102A5C]"
                >
                  <Paperclip className="h-4 w-4" aria-hidden="true" />
                </button>

                {voiceSupported ? (
                  <button
                    type="button"
                    onClick={isListening ? stopListening : () => void startListening()}
                    disabled={isSending || isTranscribing}
                    aria-label={isListening ? t.chat.voiceStop : t.chat.voiceStart}
                    title={isListening ? t.chat.voiceStop : t.chat.voiceStart}
                    className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border transition-colors duration-150 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#102A5C] ${
                      isListening
                        ? 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-500/45 text-red-700 dark:text-red-300'
                        : 'bg-white dark:bg-[#0D1B36] border-blue-900/20 dark:border-blue-400/25 text-[#102A5C] dark:text-blue-300 hover:bg-[#EAF0FA] dark:hover:bg-[#132852] disabled:opacity-40'
                    }`}
                  >
                    {isTranscribing ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : isListening ? (
                      <MicOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Mic className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                ) : null}

                <button
                  type="submit"
                  disabled={(!draft.trim() && attachments.length === 0) || isSending}
                  aria-label={t.chat.send}
                  className="min-h-[44px] min-w-[44px] px-3.5 py-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 text-white text-sm font-medium transition-colors duration-150 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#102A5C] focus-visible:ring-offset-2"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline">{t.chat.send}</span>
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 min-h-[18px]">
                <span>{t.chat.composerHint}</span>
                {isListening || isTranscribing ? (
                  <span className="text-[#102A5C] dark:text-blue-300 font-medium">
                    {isTranscribing ? t.chat.voiceTranscribing : t.chat.voiceListening}
                  </span>
                ) : null}
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
