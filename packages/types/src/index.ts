import { z } from 'zod';

// Language detection types
export interface LanguageDetectionResult {
  language: string;
  confidence?: number;
}

// Translation types
export interface TranslationResult {
  targetLanguage: string;
  translatedText: string;
  success: boolean;
  error?: string;
}

// Configuration schemas
export const EnvConfigSchema = z.object({
  slackBotToken: z.string(),
  slackAppToken: z.string(),
  geminiApiKey: z.string(),
  targetLangs: z.array(z.string()),
  threadMode: z.boolean(),
  modelName: z.string(),
  genTimeoutMs: z.number(),
  retryMax: z.number(),
  port: z.number(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
  maskTextInLogs: z.boolean(),
});

export type EnvConfig = z.infer<typeof EnvConfigSchema>;

// Slack types
export interface SlackMessageEvent {
  channel: string;
  ts: string;
  user: string;
  text: string;
  thread_ts?: string;
}

// Translation metrics
export interface TranslationMetrics {
  workspaceId: string;
  channelId: string;
  messageTs: string;
  sourceLang: string;
  targetLangs: string[];
  latencyMs: number;
  successfulTranslations: number;
  failedTranslations: number;
  timestamp: Date;
}

// Storage adapter types
export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

// Admin console types
export interface DashboardStats {
  totalTranslations: number;
  successRate: number;
  avgLatency: number;
  activeWorkspaces: number;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  translationCount: number;
  lastActivity: Date;
}