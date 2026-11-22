import { ArrowRight, Search, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useLanguage } from '../../i18n/languageContext';
import type { MemoryCategory, MemoryItem } from '../../types/assistant';

interface MemoryViewProps {
  memories: MemoryItem[];
  onCreateMemory: (input: {
    fact: string;
    category: MemoryCategory;
  }) => Promise<unknown>;
  onDeleteMemory: (id: string) => Promise<void>;
  onDraftInAssistant: (prompt: string) => void;
}

export function MemoryView({
  memories,
  onCreateMemory,
  onDeleteMemory,
  onDraftInAssistant,
}: MemoryViewProps) {
  const { t, formatDateTime } = useLanguage();
  const [fact, setFact] = useState('');
  const [category, setCategory] = useState<MemoryCategory>('preference');
  const [search, setSearch] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fact.trim()) return;
    await onCreateMemory({ fact: fact.trim(), category });
    setFact('');
  };

  const filteredMemories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return memories;
    return memories.filter((m) => m.fact.toLowerCase().includes(q));
  }, [memories, search]);

  const categoryLabel = (cat: MemoryCategory) =>
    cat === 'preference'
      ? t.memory.categoryPreference
      : cat === 'workflow'
      ? t.memory.categoryWorkflow
      : t.memory.categoryContext;

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFD] dark:bg-[#071126] px-4 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#1E3A8A]/80 dark:text-blue-300/80">{t.memory.kicker}</p>
            <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight text-[#0B1B3B] dark:text-slate-100">
              {t.memory.title}
            </h2>
            <p className="text-sm lg:text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              {t.memory.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDraftInAssistant(t.memory.askAssistantPrompt)}
            className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <span>{t.memory.askAssistant}</span>
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </button>
        </section>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="p-4 sm:p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] flex flex-col sm:flex-row gap-3"
        >
          <input
            type="text"
            dir="auto"
            value={fact}
            onChange={(e) => setFact(e.target.value)}
            placeholder={t.memory.factPlaceholder}
            className="flex-1 min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as MemoryCategory)}
            className="min-h-[44px] px-3 py-2 rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-sm text-[#0B1B3B] dark:text-slate-100"
          >
            <option value="preference" className="bg-white dark:bg-[#0D1B36]">{t.memory.categoryPreference}</option>
            <option value="context" className="bg-white dark:bg-[#0D1B36]">{t.memory.categoryContext}</option>
            <option value="workflow" className="bg-white dark:bg-[#0D1B36]">{t.memory.categoryWorkflow}</option>
          </select>
          <button
            type="submit"
            disabled={!fact.trim()}
            className="min-h-[44px] px-5 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {t.memory.saveButton}
          </button>
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
            placeholder={t.memory.searchPlaceholder}
            className="w-full min-h-[40px] ps-9 pe-3 py-2 text-sm rounded-lg border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
          />
        </div>

        {filteredMemories.length === 0 ? (
          <div className="p-8 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-center space-y-1.5">
            <p className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">{t.memory.emptyTitle}</p>
            <p className="text-xs text-slate-600 dark:text-slate-300">{t.memory.emptySubtitle}</p>
          </div>
        ) : (
          <ul className="divide-y divide-blue-950/10 dark:divide-blue-400/15 border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] rounded-xl overflow-hidden">
            {filteredMemories.map((item) => (
              <li
                key={item.id}
                className="p-4 flex items-center justify-between gap-4 hover:bg-[#F8FAFD] dark:hover:bg-[#132852]/50 transition-colors"
              >
                <div className="min-w-0 space-y-1">
                  <p dir="auto" className="text-sm text-[#0B1B3B] dark:text-slate-100 leading-relaxed">
                    {item.fact}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{categoryLabel(item.category)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatDateTime(item.updatedAt)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void onDeleteMemory(item.id)}
                  aria-label={t.memory.deleteMemory}
                  className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-500/35 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
