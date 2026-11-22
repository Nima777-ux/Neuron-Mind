import { Menu, Plus, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useLanguage } from '../../i18n/languageContext';
import type { NavigationSection } from '../../types/assistant';
import { NeuronMindWordmark } from '../brand/NeuronMindLogo';

interface TopBarProps {
  activeSection: NavigationSection;
  onOpenMobileMenu: () => void;
  onNewConversation: () => void;
  onOpenAssistant: () => void;
  onRefreshOverview: () => void;
  isRefreshing: boolean;
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  onSyncNow: () => void;
}

export function TopBar({
  activeSection,
  onOpenMobileMenu,
  onNewConversation,
  onOpenAssistant,
  onRefreshOverview,
  isRefreshing,
  isOnline,
  pendingCount,
  isSyncing,
  onSyncNow,
}: TopBarProps) {
  const { t, formatNumber } = useLanguage();
  const sectionLabel = t.nav[activeSection];

  return (
    <header className="h-14 shrink-0 bg-white dark:bg-[#0B1730] border-b border-blue-950/12 dark:border-blue-400/15 px-4 lg:px-8 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label={t.nav.openMenu}
          className="lg:hidden min-h-[40px] min-w-[40px] -ms-2 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:text-[#0B1B3B] dark:hover:text-white hover:bg-[#EEF3FA] dark:hover:bg-[#13254A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#102A5C] dark:focus-visible:ring-blue-400"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="hidden sm:inline-flex items-center shrink-0">
            <NeuronMindWordmark tone="light-surface" size="sm" text={t.brandName} />
          </span>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-600" aria-hidden="true">
            /
          </span>
          <h1 className="font-display font-semibold text-base text-[#0B1B3B] dark:text-slate-100 truncate">
            {sectionLabel}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
          {isOnline ? (
            <Wifi className="h-3.5 w-3.5 text-green-700 dark:text-emerald-400" aria-hidden="true" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" aria-hidden="true" />
          )}
          <span
            className={
              isOnline
                ? 'text-slate-600 dark:text-slate-300'
                : 'text-amber-800 dark:text-amber-300 font-medium'
            }
          >
            {isOnline ? t.topbar.online : t.topbar.offline}
          </span>
          {pendingCount > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={onSyncNow}
                disabled={!isOnline || isSyncing}
                className="font-medium text-[#102A5C] dark:text-blue-300 hover:underline disabled:opacity-50 tabular-nums"
              >
                {isSyncing
                  ? t.topbar.syncing
                  : `${formatNumber(pendingCount)} ${t.topbar.pendingSync}`}
              </button>
            </>
          ) : null}
        </div>

        {activeSection === 'assistant' ? (
          <button
            type="button"
            onClick={onNewConversation}
            className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#102A5C] hover:bg-[#0B1D42] dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#102A5C] dark:focus-visible:ring-blue-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B1730]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{t.topbar.newThread}</span>
          </button>
        ) : activeSection === 'settings' ? (
          <button
            type="button"
            onClick={onRefreshOverview}
            disabled={isRefreshing}
            className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#102A5C] dark:text-blue-200 bg-[#F3F6FB] dark:bg-[#13254A] border border-blue-900/15 dark:border-blue-400/20 hover:bg-[#E7EEF8] dark:hover:bg-[#1B3363] disabled:opacity-60 rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#102A5C] dark:focus-visible:ring-blue-400"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{t.topbar.refreshStatus}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenAssistant}
            className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#102A5C] hover:bg-[#0B1D42] dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#102A5C] dark:focus-visible:ring-blue-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B1730]"
          >
            <span>{t.topbar.openAssistant}</span>
          </button>
        )}
      </div>
    </header>
  );
}
