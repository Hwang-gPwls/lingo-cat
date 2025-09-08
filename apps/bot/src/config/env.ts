import { config } from 'dotenv';

// Load environment variables from .env file
config();

export interface EnvConfig {
  // Gemini API Configuration
  geminiApiKey: string;
  
  // Slack Configuration
  slackBotToken: string;
  slackAppToken: string;
  
  // Translation Configuration
  targetLangs: string[];
  threadMode: boolean;
  modelName: string;
  genTimeoutMs: number;
  retryMax: number;
  
  // Server Configuration
  port: number;
  logLevel: string;
  maskTextInLogs: boolean;
}

const parseTargetLangs = (langsString: string): string[] => {
  return langsString.split(',').map(lang => lang.trim()).filter(lang => lang.length > 0);
};

const validateRequiredEnvVar = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
};

export const envConfig: EnvConfig = {
  geminiApiKey: validateRequiredEnvVar('GEMINI_API_KEY', process.env.GEMINI_API_KEY),
  slackBotToken: validateRequiredEnvVar('SLACK_BOT_TOKEN', process.env.SLACK_BOT_TOKEN),
  slackAppToken: validateRequiredEnvVar('SLACK_APP_TOKEN', process.env.SLACK_APP_TOKEN),
  targetLangs: parseTargetLangs(process.env.TARGET_LANGS || 'ko,ja'),
  threadMode: process.env.THREAD_MODE !== 'false',
  modelName: process.env.MODEL_NAME || 'gemini-2.0-flash-exp',
  genTimeoutMs: parseInt(process.env.GEN_TIMEOUT_MS || '8000', 10),
  retryMax: parseInt(process.env.RETRY_MAX || '2', 10),
  port: parseInt(process.env.PORT || '3000', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  maskTextInLogs: process.env.MASK_TEXT_IN_LOGS === 'true'
};

export default envConfig;
