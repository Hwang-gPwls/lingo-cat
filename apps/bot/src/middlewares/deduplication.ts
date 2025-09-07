/**
 * Deduplication middleware to prevent duplicate translations and bot loops
 */

interface CacheEntry {
  timestamp: number;
  processed: boolean;
}

class DeduplicationCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Generate cache key from channel ID and message timestamp
   */
  private generateKey(channelId: string, messageTs: string): string {
    return `${channelId}:${messageTs}`;
  }

  /**
   * Clean expired entries from cache
   */
  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL_MS) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Check if message has already been processed
   */
  isProcessed(channelId: string, messageTs: string): boolean {
    this.cleanExpired();
    
    const key = this.generateKey(channelId, messageTs);
    const entry = this.cache.get(key);
    
    return entry?.processed || false;
  }

  /**
   * Mark message as processed
   */
  markProcessed(channelId: string, messageTs: string): void {
    const key = this.generateKey(channelId, messageTs);
    this.cache.set(key, {
      timestamp: Date.now(),
      processed: true
    });
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; oldestEntry: number | null } {
    this.cleanExpired();
    
    let oldestTimestamp: number | null = null;
    for (const entry of this.cache.values()) {
      if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
    }
    
    return {
      size: this.cache.size,
      oldestEntry: oldestTimestamp
    };
  }

  /**
   * Clear all cache entries (for testing)
   */
  clear(): void {
    this.cache.clear();
  }
}

// Global deduplication cache instance
export const dedupCache = new DeduplicationCache();

/**
 * Check if message should be ignored to prevent bot loops
 */
export const shouldIgnoreForBotLoop = (message: any): boolean => {
  // Ignore messages from bots (including our own bot)
  if (message.bot_id || message.subtype === 'bot_message') {
    return true;
  }

  // Ignore messages from app/bot users
  if (message.app_id) {
    return true;
  }

  // Ignore system/automated messages
  if (message.subtype && message.subtype !== 'message_changed') {
    return true;
  }

  // Additional check for bot indicators in username
  if (message.username && message.username.toLowerCase().includes('bot')) {
    return true;
  }

  return false;
};

/**
 * Comprehensive message filtering for translation eligibility
 */
export const shouldProcessMessage = (message: any): { 
  shouldProcess: boolean; 
  reason?: string;
  channelId: string;
  messageTs: string;
} => {
  const channelId = message.channel;
  const messageTs = message.ts;

  // Basic bot loop prevention
  if (shouldIgnoreForBotLoop(message)) {
    return {
      shouldProcess: false,
      reason: 'Bot message or system message',
      channelId,
      messageTs
    };
  }

  // Check if already processed
  if (dedupCache.isProcessed(channelId, messageTs)) {
    return {
      shouldProcess: false,
      reason: 'Already processed',
      channelId,
      messageTs
    };
  }

  // Check for empty or whitespace-only text
  if (!message.text || message.text.trim().length === 0) {
    return {
      shouldProcess: false,
      reason: 'Empty or whitespace-only message',
      channelId,
      messageTs
    };
  }

  // Check for emoji-only messages (simple pattern)
  const emojiOnlyPattern = /^[\s\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]*$/u;
  if (emojiOnlyPattern.test(message.text)) {
    return {
      shouldProcess: false,
      reason: 'Emoji-only message',
      channelId,
      messageTs
    };
  }

  // Check for ignore commands
  if (message.text.toLowerCase().includes('/ignore') || 
      message.text.toLowerCase().includes('!ignore')) {
    return {
      shouldProcess: false,
      reason: 'Ignore command detected',
      channelId,
      messageTs
    };
  }

  // Check for very short messages that might not be meaningful for translation
  if (message.text.trim().length < 3) {
    return {
      shouldProcess: false,
      reason: 'Message too short for translation',
      channelId,
      messageTs
    };
  }

  return {
    shouldProcess: true,
    channelId,
    messageTs
  };
};

/**
 * Mark message as processed in deduplication cache
 */
export const markMessageProcessed = (channelId: string, messageTs: string): void => {
  dedupCache.markProcessed(channelId, messageTs);
};

/**
 * Get deduplication cache statistics for monitoring
 */
export const getDedupStats = () => {
  return dedupCache.getStats();
};
