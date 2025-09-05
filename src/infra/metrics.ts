/**
 * Metrics and logging infrastructure for LingoCat
 */

import { envConfig } from '../config/env';
import { maskText } from '../utils/text';

export interface TranslationMetrics {
  workspaceId: string;
  channelId: string;
  messageTs: string;
  sourceLang: string;
  targetLangs: string[];
  latencyMs: number;
  success: boolean;
  successfulTranslations: number;
  failedTranslations: number;
  errorType?: string;
  timestamp: string;
}

export interface SystemMetrics {
  qps: number;
  successRate: number;
  avgLatency: number;
  p95Latency: number;
  memoryUsage: NodeJS.MemoryUsage;
  cacheSize: number;
  timestamp: string;
}

class MetricsCollector {
  private translationMetrics: TranslationMetrics[] = [];
  private readonly MAX_METRICS_HISTORY = 1000;
  private readonly METRICS_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Record a translation event
   */
  recordTranslation(metrics: TranslationMetrics): void {
    this.translationMetrics.push(metrics);
    
    // Keep only recent metrics to prevent memory bloat
    if (this.translationMetrics.length > this.MAX_METRICS_HISTORY) {
      this.translationMetrics = this.translationMetrics.slice(-this.MAX_METRICS_HISTORY);
    }

    // Log structured event
    this.logTranslationEvent(metrics);
  }

  /**
   * Get system metrics for the recent time window
   */
  getSystemMetrics(): SystemMetrics {
    const now = Date.now();
    const windowStart = now - this.METRICS_WINDOW_MS;
    
    const recentMetrics = this.translationMetrics.filter(
      m => new Date(m.timestamp).getTime() > windowStart
    );

    if (recentMetrics.length === 0) {
      return {
        qps: 0,
        successRate: 0,
        avgLatency: 0,
        p95Latency: 0,
        memoryUsage: process.memoryUsage(),
        cacheSize: 0,
        timestamp: new Date().toISOString()
      };
    }

    // Calculate QPS (queries per second)
    const qps = recentMetrics.length / (this.METRICS_WINDOW_MS / 1000);
    
    // Calculate success rate
    const successfulEvents = recentMetrics.filter(m => m.success).length;
    const successRate = successfulEvents / recentMetrics.length;
    
    // Calculate latency metrics
    const latencies = recentMetrics.map(m => m.latencyMs).sort((a, b) => a - b);
    const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95Latency = latencies[p95Index] || 0;

    return {
      qps,
      successRate,
      avgLatency,
      p95Latency,
      memoryUsage: process.memoryUsage(),
      cacheSize: 0, // Will be populated by caller
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get recent translation events for monitoring
   */
  getRecentTranslations(limit: number = 50): TranslationMetrics[] {
    return this.translationMetrics.slice(-limit);
  }

  /**
   * Log structured translation event
   */
  private logTranslationEvent(metrics: TranslationMetrics): void {
    const logData = {
      level: 'info',
      event: 'translation',
      ts: metrics.timestamp,
      ws: metrics.workspaceId,
      ch: metrics.channelId,
      msg_ts: metrics.messageTs,
      src: metrics.sourceLang,
      targets: metrics.targetLangs,
      latency_ms: metrics.latencyMs,
      ok: metrics.success,
      successful_count: metrics.successfulTranslations,
      failed_count: metrics.failedTranslations,
      error_type: metrics.errorType
    };

    console.log(JSON.stringify(logData));
  }

  /**
   * Clear metrics history (for testing)
   */
  clear(): void {
    this.translationMetrics = [];
  }
}

// Global metrics collector instance
export const metricsCollector = new MetricsCollector();

/**
 * Logger utility with structured logging
 */
export class Logger {
  private static formatMessage(
    level: string, 
    message: string, 
    context?: Record<string, any>
  ): string {
    const logEntry = {
      level,
      timestamp: new Date().toISOString(),
      message: envConfig.maskTextInLogs ? maskText(message, true) : message,
      ...context
    };

    return JSON.stringify(logEntry);
  }

  static info(message: string, context?: Record<string, any>): void {
    console.log(this.formatMessage('info', message, context));
  }

  static warn(message: string, context?: Record<string, any>): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  static error(message: string, error?: Error, context?: Record<string, any>): void {
    const errorContext = {
      ...context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };
    
    console.error(this.formatMessage('error', message, errorContext));
  }

  static debug(message: string, context?: Record<string, any>): void {
    if (envConfig.logLevel === 'debug') {
      console.log(this.formatMessage('debug', message, context));
    }
  }
}

/**
 * Performance timer utility
 */
export class PerformanceTimer {
  private startTime: number;
  private endTime?: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Stop the timer and return elapsed time in milliseconds
   */
  stop(): number {
    this.endTime = Date.now();
    return this.endTime - this.startTime;
  }

  /**
   * Get elapsed time without stopping the timer
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Create a performance timer
 */
export const createTimer = (): PerformanceTimer => {
  return new PerformanceTimer();
};

/**
 * Record a successful translation event
 */
export const recordTranslationSuccess = (
  workspaceId: string,
  channelId: string,
  messageTs: string,
  sourceLang: string,
  targetLangs: string[],
  latencyMs: number,
  successfulCount: number,
  failedCount: number
): void => {
  metricsCollector.recordTranslation({
    workspaceId,
    channelId,
    messageTs,
    sourceLang,
    targetLangs,
    latencyMs,
    success: true,
    successfulTranslations: successfulCount,
    failedTranslations: failedCount,
    timestamp: new Date().toISOString()
  });
};

/**
 * Record a failed translation event
 */
export const recordTranslationFailure = (
  workspaceId: string,
  channelId: string,
  messageTs: string,
  sourceLang: string,
  targetLangs: string[],
  latencyMs: number,
  errorType: string
): void => {
  metricsCollector.recordTranslation({
    workspaceId,
    channelId,
    messageTs,
    sourceLang,
    targetLangs,
    latencyMs,
    success: false,
    successfulTranslations: 0,
    failedTranslations: targetLangs.length,
    errorType,
    timestamp: new Date().toISOString()
  });
};

/**
 * Get current system metrics
 */
export const getSystemMetrics = (): SystemMetrics => {
  return metricsCollector.getSystemMetrics();
};

/**
 * Get recent translation events
 */
export const getRecentTranslations = (limit?: number): TranslationMetrics[] => {
  return metricsCollector.getRecentTranslations(limit);
};
