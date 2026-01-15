/**
 * Realtime Sync Service
 * 
 * Manages Supabase Realtime subscriptions to broadcast state changes
 * from database to all connected clients in real-time.
 * 
 * Part of Closed-Loop UX Synchronization pattern.
 * Ensures all clients see consistent state without polling.
 * 
 * Usage:
 * ```
 * const realtimeSync = new RealtimeSyncService();
 * 
 * // On client: subscribe to changes
 * realtimeSync.subscribe('bookings', (event) => {
 *   console.log('Booking changed:', event.new);
 *   updateUIWithLatestData(event.new);
 * });
 * 
 * // On server: publish changes
 * await realtimeSync.publish('bookings', { id: 1, status: 'confirmed' });
 * ```
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase-client';
import { InMemoryCache } from './cache';

/**
 * Event types for realtime changes
 */
export enum RealtimeEventType {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

/**
 * Realtime change event
 */
export interface RealtimeChangeEvent<T = any> {
  type: RealtimeEventType;
  table: string;
  new: T;
  old: T | null;
  timestamp: string;
}

/**
 * Subscription callback type
 */
export type SubscriptionCallback<T = any> = (event: RealtimeChangeEvent<T>) => void | Promise<void>;

/**
 * Subscription manager for tracking active subscriptions
 */
interface ActiveSubscription {
  channel: RealtimeChannel;
  callback: SubscriptionCallback;
  filter?: string;
}

/**
 * Realtime Sync Service
 * 
 * Manages subscriptions to database changes and publishes updates
 * across all connected clients.
 */
export class RealtimeSyncService {
  private subscriptions: Map<string, ActiveSubscription[]> = new Map();
  private channels: Map<string, RealtimeChannel> = new Map();
  private cache: InMemoryCache;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelayMs = 1000;

  constructor() {
    this.cache = new InMemoryCache();
    this.setupConnectionMonitoring();
  }

  /**
   * Subscribe to changes on a table
   * 
   * @param table Table name to subscribe to
   * @param callback Function called when changes occur
   * @param filter Optional WHERE clause filter (e.g., "id=eq.123")
   * @returns Unsubscribe function
   */
  public subscribe<T = any>(
    table: string,
    callback: SubscriptionCallback<T>,
    filter?: string
  ): () => void {
    const channelKey = `realtime:${table}:${filter || 'all'}`;

    // Get or create channel
    let channel = this.channels.get(channelKey);
    if (!channel) {
      channel = supabase.channel(channelKey);
      this.channels.set(channelKey, channel);
    }

    // Create subscription
    const subscription: ActiveSubscription = {
      channel,
      callback,
      filter,
    };

    // Add to subscriptions list
    if (!this.subscriptions.has(channelKey)) {
      this.subscriptions.set(channelKey, []);
    }
    this.subscriptions.get(channelKey)!.push(subscription);

    // Setup realtime listener
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter,
      },
      async (payload: any) => {
        try {
          const event: RealtimeChangeEvent<T> = {
            type: payload.eventType as RealtimeEventType,
            table,
            new: payload.new,
            old: payload.old || null,
            timestamp: new Date().toISOString(),
          };

          // Cache the latest state
          this.cache.set(`realtime:${table}:latest`, event.new, 3600);

          // Call callback
          await callback(event);
        } catch (error) {
          console.error(`[RealtimeSync] Error in callback for ${table}:`, error);
        }
      }
    );

    // Subscribe if not already
    if (channel.state !== 'subscribed' && channel.state !== 'subscribing') {
      channel.subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR') {
          console.error(`[RealtimeSync] Channel error for ${channelKey}`);
          this.handleChannelError(channelKey);
        }
      });
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribe(channelKey, subscription);
    };
  }

  /**
   * Unsubscribe from a channel
   */
  private unsubscribe(channelKey: string, subscription: ActiveSubscription): void {
    const subs = this.subscriptions.get(channelKey);
    if (!subs) return;

    const index = subs.indexOf(subscription);
    if (index > -1) {
      subs.splice(index, 1);
    }

    // Remove channel if no more subscriptions
    if (subs.length === 0) {
      const channel = this.channels.get(channelKey);
      if (channel) {
        channel.unsubscribe();
        this.channels.delete(channelKey);
      }
      this.subscriptions.delete(channelKey);
    }
  }

  /**
   * Publish an update to all subscribed clients
   * (Note: In production, use database triggers instead for scalability)
   */
  public async publish<T = any>(table: string, data: T, type: RealtimeEventType = RealtimeEventType.UPDATE): Promise<void> {
    try {
      // Cache the latest state
      this.cache.set(`realtime:${table}:latest`, data, 3600);

      // For server-side publishing, use Supabase's broadcast feature
      const channel = supabase.channel(`broadcast:${table}`);

      await channel.send({
        type: 'broadcast',
        event: `${table}_change`,
        payload: {
          type,
          table,
          new: data,
          timestamp: new Date().toISOString(),
        },
      });

      channel.unsubscribe();
    } catch (error) {
      console.error(`[RealtimeSync] Error publishing to ${table}:`, error);
      throw error;
    }
  }

  /**
   * Get cached latest state for a table
   */
  public getLatest<T = any>(table: string): T | null {
    return this.cache.get<T>(`realtime:${table}:latest`);
  }

  /**
   * Wait for a specific change on a table (useful for testing)
   */
  public waitForChange<T = any>(
    table: string,
    timeoutMs: number = 5000,
    filter?: (event: RealtimeChangeEvent<T>) => boolean
  ): Promise<RealtimeChangeEvent<T>> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timeout waiting for change on ${table}`));
      }, timeoutMs);

      const unsubscribe = this.subscribe(table, (event: RealtimeChangeEvent<T>) => {
        if (!filter || filter(event)) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(event);
        }
      });
    });
  }

  /**
   * Handle channel connection errors
   */
  private handleChannelError(channelKey: string): void {
    const channel = this.channels.get(channelKey);
    if (channel) {
      channel.unsubscribe();
    }

    // Attempt to reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1);

      setTimeout(() => {
        console.log(`[RealtimeSync] Reconnecting to ${channelKey} (attempt ${this.reconnectAttempts})`);
        const subs = this.subscriptions.get(channelKey);
        if (subs && subs.length > 0) {
          const sub = subs[0];
          this.channels.delete(channelKey);
          this.subscribe(sub.channel.topic.split(':')[1], sub.callback, sub.filter);
        }
      }, Math.min(delay, 30000));
    }
  }

  /**
   * Setup connection monitoring
   */
  private setupConnectionMonitoring(): void {
    if (typeof window === 'undefined') return; // Server-side only

    window.addEventListener('online', () => {
      console.log('[RealtimeSync] Network restored, reconnecting all channels');
      this.reconnectAttempts = 0;
      this.reconnectAllChannels();
    });

    window.addEventListener('offline', () => {
      console.log('[RealtimeSync] Network lost');
    });
  }

  /**
   * Reconnect all active channels
   */
  private reconnectAllChannels(): void {
    for (const [channelKey, channel] of this.channels.entries()) {
      if (channel.state !== 'subscribed') {
        channel.subscribe();
      }
    }
  }

  /**
   * Get number of active subscriptions
   */
  public getSubscriptionCount(): number {
    let count = 0;
    for (const subs of this.subscriptions.values()) {
      count += subs.length;
    }
    return count;
  }

  /**
   * Cleanup all subscriptions
   */
  public async destroy(): Promise<void> {
    for (const [channelKey, channel] of this.channels.entries()) {
      await channel.unsubscribe();
    }
    this.channels.clear();
    this.subscriptions.clear();
    this.cache.clear();
  }
}

// Singleton instance for app-wide use
let instance: RealtimeSyncService | null = null;

/**
 * Get or create singleton instance of RealtimeSyncService
 */
export function getRealtimeSyncService(): RealtimeSyncService {
  if (!instance) {
    instance = new RealtimeSyncService();
  }
  return instance;
}

/**
 * Reset singleton (mainly for testing)
 */
export function resetRealtimeSyncService(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
