import { GoogleGenerativeAI } from '@langchain/google-genai';
import { envConfig } from '../config/env';
import { preserveFormatting } from '../utils/text';

const genAI = new GoogleGenerativeAI({
  apiKey: envConfig.geminiApiKey,
  model: envConfig.modelName
});

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
1. Preserve any code blocks (```) and inline code (`), links, and mentions (@user) exactly as they are
2. Maintain the original formatting and structure
3. Return ONLY the translated text without any additional commentary
4. If the text contains technical terms, preserve them appropriately

Text to translate: "${text}"

Translation:`;

    const model = genAI.getGenerativeModel({ model: envConfig.modelName });
    
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Translation timeout')), envConfig.genTimeoutMs)
      )
    ]) as any;

    const response = result.response;
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
 * Format translation results for Slack posting
 */
export const formatTranslationResults = (
  sourceLang: string, 
  targetLangs: string[], 
  results: TranslationResult[]
): string => {
  const header = `*LingoCat* detected \`${sourceLang}\` → ${targetLangs.map(t => `\`${t}\``).join(', ')}`;
  
  const translations = results.map(result => {
    if (result.success && result.translatedText) {
      return `• *${result.targetLanguage}*: ${result.translatedText}`;
    } else {
      return `• *${result.targetLanguage}*: _translation failed_`;
    }
  });
  
  return `${header}\n${translations.join('\n')}`;
};
