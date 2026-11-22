import type { AppLanguage } from '../types/assistant';

export function detectTextLanguage(text: string): AppLanguage {
  const persianMatches = text.match(/[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/g);
  const latinMatches = text.match(/[A-Za-z]/g);
  const persianCount = persianMatches ? persianMatches.length : 0;
  const latinCount = latinMatches ? latinMatches.length : 0;
  if (persianCount === 0) return 'en';
  if (persianCount >= latinCount || persianCount >= 3) return 'fa';
  return 'en';
}
