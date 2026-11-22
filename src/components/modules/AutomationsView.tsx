import { ArrowRight, Play, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLanguage } from '../../i18n/languageContext';
import type { AutomationRule } from '../../types/assistant';

interface AutomationsViewProps {
  automations: AutomationRule[];
  onCreateAutomation: (input: {
    name: string;
    trigger: string;
    actionSummary: string;
  }) => Promise<unknown>;
  onToggleAutomation: (id: string) => Promise<void>;
  onDeleteAutomation: (id: string) => Promise<void>;
  onRunAutomation: (rule: AutomationRule) => Promise<void>;
  onDraftInAssistant: (prompt: string) => void;
}

export function AutomationsView({
  automations,
  onCreateAutomation,
  onToggleAutomation,
  onDeleteAutomation,
  onRunAutomation,
  onDraftInAssistant,
}: AutomationsViewProps) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('');
  const [actionSummary, setActionSummary] = useState('');
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runNotice, setRunNotice] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !trigger.trim() || !actionSummary.trim()) return;
    await onCreateAutomation({
      name: name.trim(),
      trigger: trigger.trim(),
      actionSummary: actionSummary.trim(),
    });
    setName('');
    setTrigger('');
    setActionSummary('');
  };

  const handleRunRule = async (rule: AutomationRule) => {
    setRunningId(rule.id);
    setRunNotice(null);
    try {
      await onRunAutomation(rule);
      setRunNotice(`${rule.name}: ${t.extras.automationRanNotice}`);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFD] dark:bg-[#071126] px-4 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#1E3A8A]/80 dark:text-blue-300/80">
              {t.automations.kicker}
            </p>
            <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight text-[#0B1B3B] dark:text-slate-100">
              {t.automations.title}
            </h2>
            <p className="text-sm lg:text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              {t.automations.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDraftInAssistant(t.automations.askAssistantPrompt)}
            className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <span>{t.automations.askAssistant}</span>
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </button>
        </section>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="p-4 sm:p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              dir="auto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.automations.namePlaceholder}
              className="min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
            />
            <input
              type="text"
              dir="auto"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder={t.automations.triggerPlaceholder}
              className="min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              dir="auto"
              value={actionSummary}
              onChange={(e) => setActionSummary(e.target.value)}
              placeholder={t.automations.actionPlaceholder}
              className="flex-1 min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!name.trim() || !trigger.trim() || !actionSummary.trim()}
              className="min-h-[44px] px-5 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {t.automations.createButton}
            </button>
          </div>
        </form>

        {runNotice ? (
          <div className="p-3.5 rounded-xl border border-blue-900/15 dark:border-blue-400/25 bg-[#EAF0FA] dark:bg-[#132852] text-xs font-medium text-[#102A5C] dark:text-blue-200">
            {runNotice}
          </div>
        ) : null}

        {automations.length === 0 ? (
          <div className="p-8 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-center space-y-1.5">
            <p className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
              {t.automations.emptyTitle}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300">{t.automations.emptySubtitle}</p>
          </div>
        ) : (
          <ul className="divide-y divide-blue-950/10 dark:divide-blue-400/15 border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] rounded-xl overflow-hidden">
            {automations.map((rule) => (
              <li
                key={rule.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F8FAFD] dark:hover:bg-[#132852]/50 transition-colors"
              >
                <div className="min-w-0 space-y-1">
                  <p dir="auto" className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
                    {rule.name}
                  </p>
                  <p dir="auto" className="text-xs text-slate-600 dark:text-slate-300">
                    {rule.trigger} · {rule.actionSummary}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    disabled={runningId === rule.id}
                    onClick={() => void handleRunRule(rule)}
                    className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 text-white disabled:opacity-50"
                  >
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.extras.runAutomationNow}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void onToggleAutomation(rule.id)}
                    className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      rule.enabled
                        ? 'bg-[#EAF0FA] dark:bg-[#132852] border-[#102A5C]/30 dark:border-blue-400/35 text-[#102A5C] dark:text-blue-200'
                        : 'bg-slate-100 dark:bg-[#09142B] border-slate-200 dark:border-blue-400/20 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {rule.enabled ? t.automations.enabled : t.automations.paused}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteAutomation(rule.id)}
                    aria-label={t.automations.deleteRule}
                    className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-500/35 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
