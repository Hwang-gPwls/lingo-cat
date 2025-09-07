// Re-export all translation and detection functionality
export * from './detect';
export * from './translate';

// Core utilities
export { preserveFormatting, splitLongMessage } from './utils';

// Language code to flag emoji mapping
export const flagMap: Record<string, string> = {
  en: ':us:',
  ja: ':jp:',
  ko: ':kr:',
  fr: ':fr:',
  zh: ':cn:',
  es: ':es:',
  de: ':de:',
  it: ':it:',
  pt: ':flag-pt:',
  ru: ':ru:',
  ar: ':flag-sa:',
  hi: ':flag-in:',
  th: ':flag-th:',
  vi: ':flag-vn:',
  id: ':flag-id:',
  ms: ':flag-my:',
  tl: ':flag-ph:'
};