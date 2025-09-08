export interface TranslationResult {
  targetLanguage: string;
  translatedText: string;
  success: boolean;
  error?: string;
}

/**
 * Language code to flag emoji mapping
 */
const flagMap: Record<string, string> = {
  en: ':us:',
  ja: ':jp:',
  ko: ':kr:'
};

/**
 * Format translation results for Slack posting
 */
export const formatTranslationResults = (
  sourceLang: string, 
  targetLangs: string[], 
  results: TranslationResult[]
): string => {
  const translations = results.map(result => {
    const flagEmoji = flagMap[result.targetLanguage] || ':globe_with_meridians:';
    
    if (result.success && result.translatedText) {
      return `${flagEmoji} ${result.translatedText}`;
    } else {
      return `${flagEmoji} _translation failed_`;
    }
  });
  
  return translations.join('\n\n');
};
