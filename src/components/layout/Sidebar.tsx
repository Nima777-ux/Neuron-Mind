import { LogIn, LogOut, Mail, Moon, Sun, User, Users, X } from 'lucide-react';
import { NAVIGATION_ITEMS } from '../../config/navigation';
import { useLanguage } from '../../i18n/languageContext';
import { useAuth } from '../../lib/firebase/authContext';
import { useTheme } from '../../lib/theme/themeContext';
import type { NavigationSection } from '../../types/assistant';
import { NeuronMindLogo, NeuronMindWordmark } from '../brand/NeuronMindLogo';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface SidebarProps {
  activeSection: NavigationSection;
  onSelectSection: (section: NavigationSection) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenDesigners: () => void;
}

export function Sidebar({
  activeSection,
  onSelectSection,
  mobileOpen,
  onCloseMobile,
  onOpenDesigners,
}: SidebarProps) {
  const {
    status,
    user,
    googleAccessToken,
    authError,
    clearAuthError,
    connectGoogleWorkspace,
    signInWithGoogle,
    signOut,
  } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();

  const coreItems = NAVIGATION_ITEMS.filter((item) => item.group === 'core');
  const moduleItems = NAVIGATION_ITEMS.filter((item) => item.group === 'modules');
  const systemItems = NAVIGATION_ITEMS.filter((item) => item.group === 'system');

  const handleSelect = (section: NavigationSection) => {
    onSelectSection(section);
    onCloseMobile();
  };

  const renderNavGroup = (items: typeof NAVIGATION_ITEMS, label?: string) => (
    <div className="space-y-1">
      {label ? (
        <p className="px-3 pt-4 pb-1 text-xs font-medium text-blue-200/60 text-start">
          {label}
        </p>
      ) : null}
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeSection === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleSelect(item.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`w-full min-h-[42px] flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
              isActive
                ? 'bg-[#17366E] text-white font-semibold border border-blue-400/25 shadow-2xs'
                : 'text-blue-100/80 hover:text-white hover:bg-[#132C59] font-medium border border-transparent'
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 ${
                isActive ? 'text-blue-200' : 'text-blue-300/75'
              }`}
              aria-hidden="true"
            />
            <span className="truncate">{t.nav[item.id]}</span>
          </button>
        );
      })}
    </div>
  );

  const sidebarContent = (
    <div className="h-full flex flex-col bg-[#0B1B3B] dark:bg-[#050D1F] text-white border-e border-blue-950 dark:border-blue-400/15">
      <div className="h-14 flex items-center justify-between px-4 border-b border-blue-900/60 dark:border-blue-400/15 shrink-0">
        <a
          href="#assistant"
          onClick={(e) => {
            e.preventDefault();
            handleSelect('assistant');
          }}
          className="flex items-center gap-2.5 min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        >
          <NeuronMindLogo variant="emblem" className="h-9 w-9" />
          <NeuronMindWordmark tone="dark-surface" size="md" text={t.brandName} />
        </a>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label={t.nav.closeMenu}
          className="lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-blue-200 hover:text-white hover:bg-[#132C59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Workspace navigation" className="flex-1 overflow-y-auto px-3 py-4">
        {renderNavGroup(coreItems)}
        {renderNavGroup(moduleItems, t.nav.workspaceModules)}
        {renderNavGroup(systemItems, t.nav.system)}
      </nav>

      <div className="p-3 border-t border-blue-900/60 dark:border-blue-400/15 space-y-2.5 shrink-0">
        <div className="empty:hidden">
          <PWAInstallButton variant="compact" />
        </div>
        <button
          type="button"
          onClick={() => {
            onCloseMobile();
            onOpenDesigners();
          }}
          className="w-full min-h-[36px] flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#102652] hover:bg-[#17366E] text-blue-100 hover:text-white border border-blue-400/25 transition-colors"
        >
          <Users className="h-3.5 w-3.5 text-blue-200 shrink-0" aria-hidden="true" />
          <span className="truncate">{t.designers.buttonLabel}</span>
        </button>
        <div
          role="group"
          aria-label={t.settings.themeLabel}
          className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#081530] dark:bg-[#08142C] border border-blue-900/60 dark:border-blue-400/20"
        >
          <button
            type="button"
            onClick={() => setTheme('light')}
            aria-pressed={theme === 'light'}
            className={`min-h-[32px] inline-flex items-center justify-center gap-1.5 px-2 text-xs font-medium rounded-md transition-colors ${
              theme === 'light'
                ? 'bg-[#17366E] text-white shadow-2xs'
                : 'text-blue-200/75 hover:text-white'
            }`}
          >
            <Sun className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t.settings.dayMode}</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            aria-pressed={theme === 'dark'}
            className={`min-h-[32px] inline-flex items-center justify-center gap-1.5 px-2 text-xs font-medium rounded-md transition-colors ${
              theme === 'dark'
                ? 'bg-[#17366E] text-white shadow-2xs'
                : 'text-blue-200/75 hover:text-white'
            }`}
          >
            <Moon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t.settings.nightMode}</span>
          </button>
        </div>
        <div
          role="group"
          aria-label={t.settings.languageLabel}
          className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#081530] dark:bg-[#08142C] border border-blue-900/60 dark:border-blue-400/20"
        >
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`min-h-[32px] text-xs font-medium rounded-md transition-colors ${
              language === 'en'
                ? 'bg-[#17366E] text-white'
                : 'text-blue-200/75 hover:text-white'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLanguage('fa')}
            className={`min-h-[32px] text-xs font-medium rounded-md transition-colors ${
              language === 'fa'
                ? 'bg-[#17366E] text-white'
                : 'text-blue-200/75 hover:text-white'
            }`}
          >
            فارسی
          </button>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#102652]/70 border border-blue-400/15">
          <div className="h-8 w-8 rounded-lg bg-[#17366E] border border-blue-400/25 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-blue-200" aria-hidden="true" />
          </div>
          <button
            type="button"
            onClick={() => handleSelect('settings')}
            className="min-w-0 flex-1 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 rounded"
          >
            <p className="text-sm font-medium text-white truncate">
              {user?.displayName || t.auth.localWorkspace}
            </p>
            <p className="text-xs text-blue-200/75 truncate">
              {status === 'authenticated'
                ? t.auth.cloudSyncActive
                : t.auth.offlineLocalOnly}
            </p>
            {status === 'authenticated' && googleAccessToken ? (
              <p className="text-[11px] text-emerald-300/90 truncate">
                {t.auth.workspaceSessionActive}
              </p>
            ) : null}
          </button>
          {status === 'authenticated' ? (
            <button
              type="button"
              onClick={() => void signOut()}
              aria-label={t.auth.signOut}
              title={t.auth.signOut}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-blue-200 hover:text-white hover:bg-[#17366E]"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void signInWithGoogle().catch(() => undefined)}
              aria-label={t.auth.signInWithGoogle}
              title={t.auth.signInWithGoogle}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-blue-200 hover:text-white hover:bg-[#17366E]"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {status === 'authenticated' && !googleAccessToken ? (
          <button
            type="button"
            onClick={() => void connectGoogleWorkspace().catch(() => undefined)}
            className="w-full min-h-[36px] flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#17366E] hover:bg-[#1E448A] text-white border border-blue-400/25 transition-colors"
          >
            <Mail className="h-3.5 w-3.5 text-blue-200 shrink-0" aria-hidden="true" />
            <span className="truncate">{t.auth.connectWorkspaceQuick}</span>
          </button>
        ) : null}
        {authError ? (
          <div className="p-2 rounded-lg bg-red-950/60 border border-red-400/35 text-[11px] text-red-100 space-y-1">
            <p className="leading-snug break-words">{authError}</p>
            <button
              type="button"
              onClick={clearAuthError}
              className="text-[10px] underline text-red-200 hover:text-white"
            >
              {t.chat.dismiss}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-[260px] shrink-0 h-full">
        {sidebarContent}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#061024]/50"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-50 w-[260px] max-w-[82vw] h-full bg-[#0B1B3B] dark:bg-[#050D1F]">
            {sidebarContent}
          </aside>
        </div>
      ) : null}
    </>
  );
}
