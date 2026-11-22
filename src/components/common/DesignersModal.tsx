import { ArrowUpRight, Mail, MessageCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/languageContext';

interface DesignerProfile {
  id: string;
  name: string;
  initials: string;
  photoUrl: string;
  objectPositionClass: string;
  whatsappDisplay: string;
  whatsappHref: string;
  email: string;
}

const SYSTEM_DESIGNERS: DesignerProfile[] = [
  {
    id: 'nima-nabizada',
    name: 'Nima Nabizada',
    initials: 'NN',
    photoUrl: '/assets/aistudio/nima_nabizada.jpg',
    objectPositionClass: 'object-[58%_26%] scale-125',
    whatsappDisplay: '+93797355027',
    whatsappHref: 'https://wa.me/93797355027',
    email: 'nimaalkantra7@gmail.com',
  },
  {
    id: 'eqbal-ahmadi',
    name: 'Eqbal Ahmadi',
    initials: 'EA',
    photoUrl: '/assets/aistudio/eb566b9f-b9e5-4ea2-ae14-61708e6e12a0_d8890c8f.jpg',
    objectPositionClass: 'object-[50%_18%]',
    whatsappDisplay: '+93795232579',
    whatsappHref: 'https://wa.me/93795232579',
    email: 'Eqbal001ahmadi@gmail.com',
  },
];

interface DesignersModalProps {
  open: boolean;
  onClose: () => void;
}

export function DesignersModal({ open, onClose }: DesignersModalProps) {
  const { t } = useLanguage();
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="designers-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#060E20]/55 dark:bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 transition-opacity duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-200/90 dark:border-blue-400/20 bg-white dark:bg-[#0B1730] text-[#0B1B3B] dark:text-slate-100 shadow-2xl"
      >
        <div className="px-6 py-5 border-b border-slate-200/80 dark:border-blue-400/15 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2
              id="designers-modal-title"
              className="font-display text-lg sm:text-xl font-semibold tracking-tight text-[#0B1B3B] dark:text-white"
            >
              {t.designers.modalTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg">
              {t.designers.modalSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.designers.closeModal}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-blue-400/20 text-slate-500 hover:text-[#0B1B3B] dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#13254A] transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x rtl:md:divide-x-reverse divide-slate-200/80 dark:divide-blue-400/15">
          {SYSTEM_DESIGNERS.map((designer, idx) => {
            const hasError = Boolean(failedImages[designer.id]);
            return (
              <section
                key={designer.id}
                className="p-6 flex flex-col justify-between gap-5"
              >
                <div className="flex items-center gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-slate-100 dark:bg-[#071126] ring-1 ring-slate-900/15 dark:ring-blue-400/30">
                    {!hasError ? (
                      <img
                        src={designer.photoUrl}
                        alt={designer.name}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImages((prev) => ({
                            ...prev,
                            [designer.id]: true,
                          }))
                        }
                        className={`h-full w-full object-cover ${designer.objectPositionClass}`}
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-[#0B1B3B] to-[#17366E] text-white font-display text-lg font-semibold">
                        {designer.initials}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 space-y-1 text-start">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono tabular-nums">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{t.designers.roleLabel}</span>
                    </div>
                    <h3 className="font-display text-base sm:text-lg font-semibold tracking-tight text-[#0B1B3B] dark:text-white truncate">
                      {designer.name}
                    </h3>
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-slate-200/75 dark:border-blue-400/15">
                  <a
                    href={designer.whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group w-full min-h-[42px] px-4 py-2 rounded-xl border border-emerald-600/25 dark:border-emerald-400/25 bg-emerald-50/75 dark:bg-emerald-950/35 hover:bg-emerald-600 dark:hover:bg-emerald-600 text-emerald-900 dark:text-emerald-200 hover:text-white text-xs font-medium flex items-center justify-between gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="whitespace-nowrap">{t.designers.whatsappLabel}</span>
                      <span aria-hidden="true" className="opacity-50">
                        ·
                      </span>
                      <span dir="ltr" className="font-mono tabular-nums truncate">
                        {designer.whatsappDisplay}
                      </span>
                    </span>
                    <ArrowUpRight
                      className="h-3.5 w-3.5 shrink-0 opacity-65 group-hover:opacity-100 transition-opacity"
                      aria-hidden="true"
                    />
                  </a>

                  <a
                    href={`mailto:${designer.email}`}
                    className="group w-full min-h-[42px] px-4 py-2 rounded-xl border border-[#102A5C]/20 dark:border-blue-400/25 bg-[#F4F7FC] dark:bg-[#0E1E3F] hover:bg-[#102A5C] dark:hover:bg-blue-600 text-[#0B1B3B] dark:text-blue-100 hover:text-white text-xs font-medium flex items-center justify-between gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span dir="ltr" className="font-mono truncate">
                        {designer.email}
                      </span>
                    </span>
                    <ArrowUpRight
                      className="h-3.5 w-3.5 shrink-0 opacity-65 group-hover:opacity-100 transition-opacity"
                      aria-hidden="true"
                    />
                  </a>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
