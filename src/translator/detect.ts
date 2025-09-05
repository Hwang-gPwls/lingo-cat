import { GoogleGenerativeAI } from '@langchain/google-genai';
import { envConfig } from '../config/env';

const genAI = new GoogleGenerativeAI({
  apiKey: envConfig.geminiApiKey,
  model: envConfig.modelName
});

export interface LanguageDetectionResult {
  language: string;
  confidence?: number;
}

/**
 * Detect the language of the given text using Gemini API
 * Returns ISO-639-1 language code or 'und' for undefined/failed detection
 */
export const detectLanguage = async (text: string): Promise<string> => {
  try {
    const prompt = `Detect the language of the following text and return ONLY the ISO-639-1 language code (e.g., 'en', 'ko', 'ja', 'zh', 'es', 'fr'). If the language cannot be determined or is mixed, return 'und'.

Text: "${text}"

Language code:`;

    const model = genAI.getGenerativeModel({ model: envConfig.modelName });
    
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Detection timeout')), envConfig.genTimeoutMs)
      )
    ]) as any;

    const response = result.response;
    const detectedLang = response.text().trim().toLowerCase();
    
    // Validate that the response is a valid ISO-639-1 code
    const validLangCodes = [
      'en', 'ko', 'ja', 'zh', 'es', 'fr', 'de', 'it', 'pt', 'ru', 
      'ar', 'hi', 'th', 'vi', 'id', 'ms', 'tl', 'und'
    ];
    
    if (validLangCodes.includes(detectedLang)) {
      return detectedLang;
    }
    
    // If response is not a valid code, return undefined
    console.warn(`Invalid language code detected: ${detectedLang}. Defaulting to 'und'`);
    return 'und';
    
  } catch (error) {
    console.error('Language detection failed:', error);
    return 'und';
  }
};

/**
 * Detect language with retry logic
 */
export const detectLanguageWithRetry = async (text: string): Promise<string> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= envConfig.retryMax; attempt++) {
    try {
      const result = await detectLanguage(text);
      if (result !== 'und') {
        return result;
      }
      
      // If detection returns 'und', don't retry unless it's due to an error
      if (attempt === 0) {
        return 'und';
      }
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < envConfig.retryMax) {
        // Exponential backoff: 1s, 2s, 4s...
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Language detection attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`Language detection failed after ${envConfig.retryMax + 1} attempts:`, lastError);
  return 'und';
};

/**
 * Check if the detected language is supported for translation
 */
export const isSupportedLanguage = (langCode: string): boolean => {
  const supportedLangs = [...envConfig.targetLangs, 'und'];
  return supportedLangs.includes(langCode);
};
