import { Download } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useLanguage } from '../../i18n/languageContext';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'full';
}

export function PWAInstallButton({ variant = 'compact' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { t } = useLanguage();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    if (variant === 'full') {
      return (
        <span className="text-xs font-medium text-green-700 dark:text-emerald-400">
          {t.pwa.installed}
        </span>
      );
    }
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white bg-[#102A5C] hover:bg-[#0B1D42] dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#102A5C] dark:focus-visible:ring-blue-400"
      >
        <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t.pwa.installApp}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-[#102A5C] dark:text-blue-200 bg-[#F3F6FB] dark:bg-[#13254A] border border-blue-900/15 dark:border-blue-400/20 hover:bg-[#E7EEF8] dark:hover:bg-[#1B3363] rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0"
        >
          <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t.pwa.installOnIOS}</span>
        </button>

        {showIOSGuide ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061024]/50 dark:bg-black/65 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white dark:bg-[#0D1B36] p-6 border border-blue-900/15 dark:border-blue-400/20 space-y-4">
              <h3 className="font-display text-base font-semibold text-[#0B1B3B] dark:text-slate-100">
                {t.pwa.iosTitle}
              </h3>
              <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1.5">
                <p>{t.pwa.iosStep1}</p>
                <p>{t.pwa.iosStep2}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[40px] rounded-lg bg-[#102A5C] text-white text-sm font-medium hover:bg-[#0B1D42] dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                {t.pwa.close}
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return null;
}
