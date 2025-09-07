import { StorageAdapter } from '@kaia/types';

// Memory-based cache adapter (for development/testing)
export class MemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, { value: string; expires?: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    
    if (item.expires && Date.now() > item.expires) {
      this.store.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expires = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : undefined;
    this.store.set(key, { value, expires });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }
}

// Redis adapter
export class RedisStorageAdapter implements StorageAdapter {
  private redis: any;

  constructor(redisUrl: string) {
    // Lazy import to avoid requiring Redis when not needed
    // this.redis = new (require('ioredis'))(redisUrl);
  }

  async get(key: string): Promise<string | null> {
    return this.redis?.get(key) || null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis?.setex(key, ttlSeconds, value);
    } else {
      await this.redis?.set(key, value);
    }
  }

  async delete(key: string): Promise<void> {
    await this.redis?.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis?.exists(key);
    return result === 1;
  }
}

// S3 adapter for persistent storage
export class S3StorageAdapter implements StorageAdapter {
  private s3Client: any;
  private bucket: string;

  constructor(bucket: string, region: string) {
    this.bucket = bucket;
    // Lazy import to avoid requiring AWS SDK when not needed
    // this.s3Client = new (require('@aws-sdk/client-s3')).S3Client({ region });
  }

  async get(key: string): Promise<string | null> {
    try {
      // Implementation would use S3 GetObject
      return null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    // Implementation would use S3 PutObject with optional expiration metadata
  }

  async delete(key: string): Promise<void> {
    // Implementation would use S3 DeleteObject
  }

  async exists(key: string): Promise<boolean> {
    // Implementation would use S3 HeadObject
    return false;
  }
}