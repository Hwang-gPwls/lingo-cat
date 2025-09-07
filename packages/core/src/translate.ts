import { GoogleGenerativeAI } from '@google/generative-ai';
import { envConfig } from '../config/env';
import { preserveFormatting } from '../utils/text';

const genAI = new GoogleGenerativeAI(envConfig.geminiApiKey);

export interface TranslationResult {
  targetLanguage: string;
  translatedText: string;
  success: boolean;
  error?: string;
}

/**
 * Translate text from source language to target language
 */
export const translateTo = async (text: string, targetLang: string, sourceLang?: string): Promise<TranslationResult> => {
  try {
    const sourceInfo = sourceLang ? `from ${sourceLang}` : '';
    const prompt = `Translate the following text ${sourceInfo} to ${targetLang}. 

IMPORTANT RULES:
1. Preserve any code blocks (\`\`\`) and inline code (\`), links, and mentions (@user) exactly as they are
2. Maintain the original formatting and structure including line breaks, bullet points, and paragraph structure
3. Keep all Slack mentions (<@U...>) unchanged
4. Keep all emojis (:smile:, :wave:, etc.) unchanged
5. Return ONLY the translated text without any additional commentary
6. If the text contains technical terms, preserve them appropriately
7. Preserve the exact same number of line breaks as in the original text

Text to translate: "${text}"

Translation:`;

    const model = genAI.getGenerativeModel({ model: envConfig.modelName });
    
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Translation timeout')), envConfig.genTimeoutMs)
      )
    ]) as any;

    const response = await result.response;
    const translatedText = response.text().trim();
    
    return {
      targetLanguage: targetLang,
      translatedText: preserveFormatting(translatedText),
      success: true
    };
    
  } catch (error) {
    console.error(`Translation to ${targetLang} failed:`, error);
    return {
      targetLanguage: targetLang,
      translatedText: '',
      success: false,
      error: (error as Error).message
    };
  }
};

/**
 * Translate text to multiple target languages in parallel
 */
export const translateToMultiple = async (
  text: string, 
  targetLangs: string[], 
  sourceLang?: string
): Promise<TranslationResult[]> => {
  console.log(`Starting translation to ${targetLangs.length} languages:`, targetLangs);
  
  const translationPromises = targetLangs.map(lang => 
    translateToWithRetry(text, lang, sourceLang)
  );
  
  const results = await Promise.allSettled(translationPromises);
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`Translation to ${targetLangs[index]} failed:`, result.reason);
      return {
        targetLanguage: targetLangs[index],
        translatedText: '',
        success: false,
        error: result.reason?.message || 'Unknown error'
      };
    }
  });
};

/**
 * Translate with retry logic and exponential backoff
 */
export const translateToWithRetry = async (
  text: string, 
  targetLang: string, 
  sourceLang?: string
): Promise<TranslationResult> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= envConfig.retryMax; attempt++) {
    try {
      const result = await translateTo(text, targetLang, sourceLang);
      
      if (result.success) {
        return result;
      }
      
      // If translation failed but no exception, don't retry
      if (attempt === 0) {
        return result;
      }
      
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < envConfig.retryMax) {
        // Exponential backoff: 1s, 2s, 4s...
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Translation attempt ${attempt + 1} to ${targetLang} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`Translation to ${targetLang} failed after ${envConfig.retryMax + 1} attempts:`, lastError);
  return {
    targetLanguage: targetLang,
    translatedText: '',
    success: false,
    error: lastError?.message || 'Translation failed after retries'
  };
};

/**
 * Filter out target languages that are the same as source language
 */
export const filterTargetLanguages = (targetLangs: string[], sourceLang: string): string[] => {
  return targetLangs.filter(lang => lang !== sourceLang);
};

/**
 * Language code to flag emoji mapping
 */
const flagMap: Record<string, string> = {
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
