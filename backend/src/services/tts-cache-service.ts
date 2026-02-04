import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from './logger';
import { ElevenLabsClient, GeneratedAudio, TTSParams } from './elevenlabs-client';

const logger = createLogger('TTSCacheService');

// ========== INTERFACES ==========

export interface CachedAudio {
  audioBuffer: Buffer;
  scriptHash: string;
  voiceId: string;
  modelId: string;
  characterCount: number;
  cachedAt: Date;
  source: 'cache' | 'api';
}

export interface CacheMetadata {
  scriptHash: string;
  voiceId: string;
  modelId: string;
  characterCount: number;
  filePath: string;
  createdAt: string;
}

// ========== SERVICE ==========

export class TTSCacheService {
  private client: ElevenLabsClient;
  private cacheDir: string;
  private inMemoryCache: Map<string, Buffer>;
  private readonly maxInMemoryCacheMB = 100;

  constructor(client: ElevenLabsClient, cacheDir: string = 'public/audio/cache') {
    this.client = client;
    this.cacheDir = path.join(process.cwd(), 'remotion-videos', cacheDir);
    this.inMemoryCache = new Map();
  }

  /**
   * Generate content hash for cache key
   */
  private generateScriptHash(script: string, voiceId: string, modelId: string): string {
    const content = `${script}${voiceId}${modelId}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Get or generate voiceover with caching
   */
  async getOrGenerateVoiceover(params: TTSParams): Promise<CachedAudio> {
    const {
      text: script,
      voiceId,
      modelId = 'eleven_turbo_v2_5',
      stability,
      similarityBoost,
    } = params;

    // 1. Calculate hash
    const scriptHash = this.generateScriptHash(script, voiceId, modelId);

    logger.info('Checking cache for voiceover', {
      script_hash: scriptHash,
      script_length: script.length,
      voice_id: voiceId,
    });

    // 2. Check Tier 1: In-memory cache
    if (this.inMemoryCache.has(scriptHash)) {
      logger.info('Cache hit (in-memory)', { script_hash: scriptHash });
      return {
        audioBuffer: this.inMemoryCache.get(scriptHash)!,
        scriptHash,
        voiceId,
        modelId,
        characterCount: script.length,
        cachedAt: new Date(),
        source: 'cache',
      };
    }

    // 3. Check Tier 2: Filesystem cache
    try {
      const cachedAudio = await this.loadFromFileCache(scriptHash);
      if (cachedAudio) {
        logger.info('Cache hit (filesystem)', { script_hash: scriptHash });

        // Warm in-memory cache
        this.addToInMemoryCache(scriptHash, cachedAudio);

        return {
          audioBuffer: cachedAudio,
          scriptHash,
          voiceId,
          modelId,
          characterCount: script.length,
          cachedAt: new Date(),
          source: 'cache',
        };
      }
    } catch (error) {
      logger.warn('Error loading from file cache', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 4. Cache miss: Generate via ElevenLabs API
    logger.info('Cache miss, calling ElevenLabs API', {
      script_hash: scriptHash,
      character_count: script.length,
    });

    const generated = await this.client.generateSpeechWithRetry({
      text: script,
      voiceId,
      modelId,
      stability,
      similarityBoost,
    });

    // 5. Store in all cache tiers
    await this.saveToFileCache(scriptHash, generated.audioBuffer, {
      scriptHash,
      voiceId,
      modelId,
      characterCount: script.length,
      filePath: this.getCacheFilePath(scriptHash),
      createdAt: new Date().toISOString(),
    });

    this.addToInMemoryCache(scriptHash, generated.audioBuffer);

    logger.info('Voiceover generated and cached', {
      script_hash: scriptHash,
      audio_size_kb: Math.round(generated.audioBuffer.length / 1024),
    });

    return {
      audioBuffer: generated.audioBuffer,
      scriptHash,
      voiceId,
      modelId,
      characterCount: script.length,
      cachedAt: new Date(),
      source: 'api',
    };
  }

  /**
   * Get cache file path
   */
  private getCacheFilePath(scriptHash: string): string {
    return path.join(this.cacheDir, `${scriptHash}.mp3`);
  }

  /**
   * Get metadata file path
   */
  private getMetadataFilePath(scriptHash: string): string {
    return path.join(this.cacheDir, `${scriptHash}.json`);
  }

  /**
   * Load audio from filesystem cache
   */
  private async loadFromFileCache(scriptHash: string): Promise<Buffer | null> {
    const filePath = this.getCacheFilePath(scriptHash);

    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        return null;
      }

      const audioBuffer = await fs.readFile(filePath);
      return audioBuffer;
    } catch (error) {
      // File doesn't exist or can't be read
      return null;
    }
  }

  /**
   * Save audio to filesystem cache
   */
  private async saveToFileCache(
    scriptHash: string,
    audioBuffer: Buffer,
    metadata: CacheMetadata
  ): Promise<void> {
    try {
      // Ensure cache directory exists
      await fs.mkdir(this.cacheDir, { recursive: true });

      // Write audio file
      const audioPath = this.getCacheFilePath(scriptHash);
      await fs.writeFile(audioPath, audioBuffer);

      // Write metadata file
      const metadataPath = this.getMetadataFilePath(scriptHash);
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      logger.info('Saved to file cache', {
        script_hash: scriptHash,
        audio_path: audioPath,
      });
    } catch (error) {
      logger.error('Failed to save to file cache', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Add to in-memory cache with size limit
   */
  private addToInMemoryCache(scriptHash: string, audioBuffer: Buffer): void {
    // Check total cache size
    let totalSizeMB = 0;
    for (const buffer of this.inMemoryCache.values()) {
      totalSizeMB += buffer.length / (1024 * 1024);
    }

    // If adding this would exceed limit, clear oldest entries
    const newAudioMB = audioBuffer.length / (1024 * 1024);
    if (totalSizeMB + newAudioMB > this.maxInMemoryCacheMB) {
      logger.info('In-memory cache full, clearing entries', {
        current_size_mb: totalSizeMB.toFixed(2),
        new_audio_mb: newAudioMB.toFixed(2),
        max_size_mb: this.maxInMemoryCacheMB,
      });

      // Clear half the cache (FIFO approximation)
      const entriesToRemove = Math.floor(this.inMemoryCache.size / 2);
      const keys = Array.from(this.inMemoryCache.keys());
      for (let i = 0; i < entriesToRemove; i++) {
        this.inMemoryCache.delete(keys[i]);
      }
    }

    this.inMemoryCache.set(scriptHash, audioBuffer);
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    logger.info('Clearing all caches');

    // Clear in-memory cache
    this.inMemoryCache.clear();

    // Clear filesystem cache
    try {
      const files = await fs.readdir(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.mp3') || file.endsWith('.json')) {
          await fs.unlink(path.join(this.cacheDir, file));
        }
      }
      logger.info('Filesystem cache cleared', { files_deleted: files.length });
    } catch (error) {
      logger.error('Failed to clear filesystem cache', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    inMemory: { entries: number; sizeMB: number };
    filesystem: { entries: number; sizeMB: number };
  }> {
    // In-memory stats
    let inMemorySizeMB = 0;
    for (const buffer of this.inMemoryCache.values()) {
      inMemorySizeMB += buffer.length / (1024 * 1024);
    }

    // Filesystem stats
    let filesystemEntries = 0;
    let filesystemSizeMB = 0;
    try {
      const files = await fs.readdir(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.mp3')) {
          filesystemEntries++;
          const stats = await fs.stat(path.join(this.cacheDir, file));
          filesystemSizeMB += stats.size / (1024 * 1024);
        }
      }
    } catch (error) {
      // Cache directory doesn't exist yet
    }

    return {
      inMemory: {
        entries: this.inMemoryCache.size,
        sizeMB: inMemorySizeMB,
      },
      filesystem: {
        entries: filesystemEntries,
        sizeMB: filesystemSizeMB,
      },
    };
  }

  /**
   * Cleanup old cache files (older than TTL)
   */
  async cleanupOldCache(ttlDays: number = 30): Promise<number> {
    const now = Date.now();
    const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    try {
      const files = await fs.readdir(this.cacheDir);

      for (const file of files) {
        if (!file.endsWith('.mp3') && !file.endsWith('.json')) {
          continue;
        }

        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtimeMs > ttlMs) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      logger.info('Cache cleanup completed', {
        ttl_days: ttlDays,
        deleted_count: deletedCount,
      });
    } catch (error) {
      logger.error('Failed to cleanup cache', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return deletedCount;
  }
}

/**
 * Factory function to create TTS cache service
 */
export function createTTSCacheService(
  client: ElevenLabsClient,
  cacheDir?: string
): TTSCacheService {
  return new TTSCacheService(client, cacheDir);
}
