import { ArrowRight } from 'lucide-react';
import type { AgentModuleDescriptor, AssistantDomain } from '../../types/assistant';

interface DomainModuleViewProps {
  domain: AssistantDomain;
  moduleDescriptor: AgentModuleDescriptor | undefined;
  onDraftInAssistant: (prompt: string) => void;
}

const STARTER_PROMPTS: Record<AssistantDomain, string> = {
  tasks: 'Help me design the task prioritization workflow we should wire into the Tasks module.',
  emails: 'Outline what email triage rules and draft-approval safeguards we should implement next.',
  files: 'Let us plan how document indexing and citation retrieval should work in the Files module.',
  calendar: 'Help me structure daily agenda briefings and conflict checks for the Calendar module.',
  memory: 'Define what preferences and long-term facts should be stored in the Memory module.',
  automations: 'Design a safe morning briefing automation combining tasks, emails, and calendar.',
};

export function DomainModuleView({
  domain,
  moduleDescriptor,
  onDraftInAssistant,
}: DomainModuleViewProps) {
  const title = moduleDescriptor?.name ?? domain;
  const summary =
    moduleDescriptor?.summary ??
    'This modular domain is registered in the central assistant architecture and ready for incremental implementation.';

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFD] dark:bg-[#071126] px-4 lg:px-8 py-8">
      <div className="max-w-3xl mx-auto space-y-10">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#1E3A8A]/80 dark:text-blue-300/80">
            <span>Module Foundation</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{moduleDescriptor?.id ?? `module.${domain}`}</span>
            <span aria-hidden="true">·</span>
            <span>
              {moduleDescriptor?.status === 'connected'
                ? 'Connected'
                : 'Awaiting integration'}
            </span>
          </div>
          <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight text-[#0B1B3B] dark:text-slate-100">
            {title}
          </h2>
          <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
            {summary}
          </p>
        </section>

        <section className="p-6 rounded-xl border border-blue-900/15 dark:border-blue-400/25 bg-[#EAF0FA]/70 dark:bg-[#132852] space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
              No external data connected yet
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              This view is a clean architectural placeholder. External accounts, Firestore
              collections, and Gemini function-calling tools for{' '}
              <span className="font-medium text-[#0B1B3B] dark:text-white">{title}</span> will be
              connected in upcoming steps without modifying other modules.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => onDraftInAssistant(STARTER_PROMPTS[domain])}
              className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#102A5C] focus-visible:ring-offset-2"
            >
              <span>Discuss {title} with Neuron Mind</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </section>

        {moduleDescriptor ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-blue-950/12 dark:border-blue-400/15">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
                Planned Agent Capabilities
              </h3>
              <ul className="divide-y divide-blue-950/10 dark:divide-blue-400/15 border-t border-b border-blue-950/10 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] rounded-xl px-4">
                {moduleDescriptor.capabilities.map((cap) => (
                  <li key={cap.id} className="py-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-[#102A5C] dark:text-blue-300">{cap.name}</p>
                      <span className="font-mono text-xs text-slate-400 dark:text-slate-500">{cap.id}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {cap.description}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
                Next Implementation Steps
              </h3>
              <ul className="divide-y divide-blue-950/10 dark:divide-blue-400/15 border-t border-b border-blue-950/10 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] rounded-xl px-4">
                {moduleDescriptor.plannedIntegrations.map((step, index) => (
                  <li key={step} className="py-3.5 flex items-baseline gap-3 text-sm">
                    <span className="font-mono tabular-nums text-xs text-[#1E3A8A]/70 dark:text-blue-300/75 shrink-0">
                      0{index + 1}.
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">{step}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
