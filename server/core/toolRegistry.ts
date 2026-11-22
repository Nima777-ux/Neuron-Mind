import type {
  AgentModuleDescriptor,
  AgentToolModule,
  AssistantDomain,
} from './types.ts';

export class ToolRegistry {
  private readonly modules: Map<string, AgentToolModule>;

  constructor() {
    this.modules = new Map<string, AgentToolModule>();
  }

  register(module: AgentToolModule): void {
    this.modules.set(module.id, module);
  }

  getById(id: string): AgentToolModule | undefined {
    return this.modules.get(id);
  }

  getByDomain(domain: AssistantDomain): AgentToolModule | undefined {
    for (const mod of this.modules.values()) {
      if (mod.domain === domain) {
        return mod;
      }
    }
    return undefined;
  }

  listModules(): AgentToolModule[] {
    return Array.from(this.modules.values());
  }

  listDescriptors(): AgentModuleDescriptor[] {
    return this.listModules().map((mod) => ({
      id: mod.id,
      domain: mod.domain,
      name: mod.name,
      summary: mod.summary,
      status: mod.status,
      capabilities: mod.capabilities,
      plannedIntegrations: mod.plannedIntegrations,
    }));
  }
}
