import {
  Bot,
  Briefcase,
  Calendar,
  CheckSquare,
  Code2,
  Database,
  FolderOpen,
  Globe,
  Mail,
  Settings,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { NavigationSection } from '../types/assistant';

export interface NavigationItem {
  id: NavigationSection;
  label: string;
  icon: LucideIcon;
  group: 'core' | 'modules' | 'system';
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'assistant',
    label: 'Assistant',
    icon: Bot,
    group: 'core',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: CheckSquare,
    group: 'modules',
  },
  {
    id: 'emails',
    label: 'Emails',
    icon: Mail,
    group: 'modules',
  },
  {
    id: 'files',
    label: 'Files',
    icon: FolderOpen,
    group: 'modules',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    group: 'modules',
  },
  {
    id: 'memory',
    label: 'Memory',
    icon: Database,
    group: 'modules',
  },
  {
    id: 'automations',
    label: 'Automations',
    icon: Workflow,
    group: 'modules',
  },
  {
    id: 'research',
    label: 'Research & Web',
    icon: Globe,
    group: 'modules',
  },
  {
    id: 'workbench',
    label: 'Dev & Data',
    icon: Code2,
    group: 'modules',
  },
  {
    id: 'hub',
    label: 'Vault & Finance',
    icon: Briefcase,
    group: 'modules',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    group: 'system',
  },
];

export function getSectionLabel(section: NavigationSection): string {
  return NAVIGATION_ITEMS.find((item) => item.id === section)?.label ?? 'Assistant';
}
