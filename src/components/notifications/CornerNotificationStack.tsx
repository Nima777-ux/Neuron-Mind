import { ArrowRight, BellRing, Calendar, Mail, Sparkles, X } from 'lucide-react';
import { useLanguage } from '../../i18n/languageContext';
import type { CornerNotificationItem, NavigationSection } from '../../types/assistant';

interface CornerNotificationStackProps {
  items: CornerNotificationItem[];
  onDismiss: (id: string) => void;
  onOpenSection: (section: NavigationSection) => void;
}

export function CornerNotificationStack({
  items,
  onDismiss,
  onOpenSection,
}: CornerNotificationStackProps) {
  const { t, formatDateTime } = useLanguage();

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 end-5 z-40 w-[min(23rem,calc(100vw-2rem))] space-y-2.5 pointer-events-none"
    >
      {items.map((item) => {
        const Icon =
          item.kind === 'calendar'
            ? Calendar
            : item.kind === 'email_summary'
              ? Mail
              : item.kind === 'reminder'
                ? BellRing
                : Sparkles;

        const kindHeading =
          item.kind === 'calendar'
            ? t.notifications.calendarEventTitle
            : item.kind === 'email_summary'
              ? t.notifications.emailSummaryTitle
              : item.kind === 'reminder'
                ? t.notifications.reminderTitle
                : t.brandName;

        const accentClass =
          item.statusTone === 'error'
            ? 'border-red-300 dark:border-red-500/45'
            : item.statusTone === 'success'
              ? 'border-emerald-300 dark:border-emerald-500/45'
              : 'border-blue-900/20 dark:border-blue-400/35';

        const iconBgClass =
          item.statusTone === 'error'
            ? 'bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300'
            : item.statusTone === 'success'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
              : 'bg-[#EAF0FA] text-[#102A5C] dark:bg-[#17366E] dark:text-blue-200';

        return (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto rounded-xl border ${accentClass} bg-white/95 dark:bg-[#0D1B36]/95 backdrop-blur-md shadow-xl p-3.5 space-y-2 transition-all`}
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2.5 min-w-0">
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${iconBgClass}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1E3A8A]/80 dark:text-blue-300/90">
                    {kindHeading}
                  </p>
                  <p
                    dir="auto"
                    className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100 leading-snug break-words"
                  >
                    {item.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(item.id)}
                aria-label={t.notifications.dismiss}
                className="p-1 rounded-md text-slate-400 hover:text-[#0B1B3B] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#17366E] shrink-0"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {item.body ? (
              <p
                dir="auto"
                className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words"
              >
                {item.body}
              </p>
            ) : null}

            {item.meta ? (
              <p
                dir="auto"
                className={`text-xs font-medium px-2.5 py-1.5 rounded-lg break-words ${
                  item.statusTone === 'error'
                    ? 'bg-red-50 dark:bg-red-950/45 text-red-800 dark:text-red-200'
                    : 'bg-[#F8FAFD] dark:bg-[#09142B] text-[#102A5C] dark:text-blue-200 border border-blue-900/10 dark:border-blue-400/15'
                }`}
              >
                {item.meta}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="font-mono tabular-nums truncate">
                {formatDateTime(item.createdAt)}
              </span>
              {item.actionSection ? (
                <button
                  type="button"
                  onClick={() => {
                    onOpenSection(item.actionSection!);
                    onDismiss(item.id);
                  }}
                  className="inline-flex items-center gap-1 font-semibold text-[#102A5C] dark:text-blue-300 hover:underline shrink-0"
                >
                  <span>{t.notifications.openSection}</span>
                  <ArrowRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
