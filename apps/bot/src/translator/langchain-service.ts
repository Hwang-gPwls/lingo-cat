import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { envConfig } from '../config/env';
import type { TranslationResult } from './translate';

/**
 * LangChain-based translation service
 * Provides retry logic, prompt management, and observability
 */
export class LangChainTranslationService {
  private model: ChatGoogleGenerativeAI;

  constructor() {
    this.model = new ChatGoogleGenerativeAI({
      modelName: envConfig.modelName,
      apiKey: envConfig.geminiApiKey,
      maxRetries: envConfig.retryMax,
    });
  }

  /**
   * Detect language using LangChain
   */
  async detectLanguage(text: string): Promise<string> {
    try {
      const prompt = `Detect the language of the following text and return ONLY the ISO-639-1 language code (e.g., 'en', 'ko', 'ja', 'zh', 'es', 'fr'). If the language cannot be determined or is mixed, return 'und'.

Text: "${text.substring(0, 500)}"

Language code:`;

      const result = await this.model.invoke(prompt);
      const detectedLang = result.content?.toString().trim().toLowerCase() || 'und';
      
      // Validate that the response is a valid ISO-639-1 code
      const validLangCodes = [
        'en', 'ko', 'ja', 'zh', 'es', 'fr', 'de', 'it', 'pt', 'ru', 
        'ar', 'hi', 'th', 'vi', 'id', 'ms', 'tl', 'und'
      ];
      
      if (validLangCodes.includes(detectedLang)) {
        return detectedLang;
      }
      
      console.warn(`Invalid language code detected: ${detectedLang}. Defaulting to 'und'`);
      return 'und';
      
    } catch (error) {
      console.error('Language detection failed:', error);
      return 'und';
    }
  }

  /**
   * Translate text using LangChain
   */
  async translateText(text: string, targetLang: string, sourceLang?: string): Promise<TranslationResult> {
    try {
      const sourceInfo = sourceLang ? `from ${sourceLang}` : '';
      const prompt = `You are a professional translator. Translate the following text ${sourceInfo} to ${targetLang}.

CRITICAL REQUIREMENTS:
1. You MUST translate the text to ${targetLang}. DO NOT return the original text unchanged.
2. If translating to Korean (ko), use proper Korean grammar and vocabulary
3. If translating to English (en), use natural English expressions
4. Preserve any code blocks (\`\`\`) and inline code (\`) exactly as they are
5. Keep all Slack mentions (<@U...>) unchanged
6. Keep all emojis (:smile:, :wave:, etc.) unchanged  
7. Maintain the original formatting including line breaks and paragraph structure
8. Return ONLY the translated text without any additional commentary
9. Technical terms like "API", "ID" can remain in English when translating to Korean

Text to translate: "${text}"

${targetLang} translation:`;

      const result = await this.model.invoke(prompt);
      const translatedText = result.content?.toString().trim() || '';
      
      // Validation: Check if translation actually happened
      if (!translatedText || translatedText === text) {
        console.warn(`Translation may have failed - result is empty or unchanged for target: ${targetLang}`);
        return {
          targetLanguage: targetLang,
          translatedText: '',
          success: false,
          error: 'Translation returned empty or unchanged result'
        };
      }
      
      return {
        targetLanguage: targetLang,
        translatedText,
        success: true
      };
      
    } catch (error) {
      console.error(`LangChain translation to ${targetLang} failed:`, error);
      return {
        targetLanguage: targetLang,
        translatedText: '',
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Translate to multiple languages in parallel
   */
  async translateToMultiple(
    text: string, 
    targetLangs: string[], 
    sourceLang?: string
  ): Promise<TranslationResult[]> {
    console.log(`LangChain: Starting translation to ${targetLangs.length} languages:`, targetLangs);
    
    const translationPromises = targetLangs.map(lang => 
      this.translateText(text, lang, sourceLang)
    );
    
    const results = await Promise.allSettled(translationPromises);
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`LangChain translation to ${targetLangs[index]} failed:`, result.reason);
        return {
          targetLanguage: targetLangs[index],
          translatedText: '',
          success: false,
          error: result.reason?.message || 'Unknown error'
        };
      }
    });
  }
}

// Singleton instance
export const langChainTranslationService = new LangChainTranslationService();