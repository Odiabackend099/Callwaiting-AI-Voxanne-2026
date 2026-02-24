import { useEffect, useState, useCallback, useRef } from 'react';

export interface TabConflictState {
  hasConflict: boolean;
  conflictingTab?: {
    timestamp: number;
    agentType: 'inbound' | 'outbound';
    agentName: string;
  };
  message: string;
}

interface TabSession {
  tabId: string;
  timestamp: number;
  agentType: 'inbound' | 'outbound';
  agentName: string;
  lastSave?: number;
}

/**
 * Hook to detect and manage multi-tab conflicts in agent config page
 *
 * When multiple tabs have the same agent config open:
 * - This hook detects when another tab saves changes
 * - Alerts the current tab about the conflict
 * - Prevents the current tab from saving stale data
 *
 * Usage:
 * ```typescript
 * const conflict = useMultiTabConflictDetection({
 *   agentType: 'inbound',
 *   agentName: 'Inbound Agent',
 * });
 *
 * if (conflict.hasConflict) {
 *   return <ConflictAlert message={conflict.message} onRefresh={handleRefresh} />;
 * }
 * ```
 */
export function useMultiTabConflictDetection(config: {
  agentType: 'inbound' | 'outbound';
  agentName: string;
}) {
  const [conflict, setConflict] = useState<TabConflictState>({
    hasConflict: false,
    message: '',
  });

  const tabIdRef = useRef<string>('');
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const lastSaveRef = useRef<number>(0);

  // Initialize tab ID and broadcast channel
  useEffect(() => {
    // Generate unique tab ID (only once per tab)
    if (!tabIdRef.current) {
      tabIdRef.current = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }

    // Try to use BroadcastChannel for cross-tab communication
    // Falls back gracefully if not supported
    try {
      broadcastChannelRef.current = new BroadcastChannel(`agent-config-${config.agentType}`);

      broadcastChannelRef.current.onmessage = (event: MessageEvent<any>) => {
        const { type, tabId, timestamp, agentName } = event.data;

        // Ignore messages from self
        if (tabId === tabIdRef.current) return;

        if (type === 'save') {
          // Another tab saved changes - mark as conflict
          setConflict({
            hasConflict: true,
            conflictingTab: {
              timestamp,
              agentType: config.agentType,
              agentName,
            },
            message: `Another tab updated the ${config.agentType} agent (${agentName}) at ${new Date(timestamp).toLocaleTimeString()}. Refresh this tab to see the latest changes.`,
          });
        }

        if (type === 'refresh') {
          // Another tab refreshed - clear conflict for that tab
          // This allows us to detect when the other tab is active
          console.log('[Multi-Tab] Another tab refreshed or closed');
        }
      };

      return () => {
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.close();
        }
      };
    } catch (err) {
      console.warn('[Multi-Tab] BroadcastChannel not supported, using localStorage fallback');
      // BroadcastChannel not supported - use localStorage fallback
      setupLocalStorageFallback();
    }
  }, [config.agentType]);

  // Fallback using localStorage for browsers without BroadcastChannel
  const setupLocalStorageFallback = useCallback(() => {
    const storageKey = `agent-config-${config.agentType}-save`;
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          // Ignore messages from self (check timestamp proximity)
          const now = Date.now();
          if (Math.abs(now - data.timestamp) > 1000) {
            // More than 1 second difference = different tab
            setConflict({
              hasConflict: true,
              conflictingTab: {
                timestamp: data.timestamp,
                agentType: config.agentType,
                agentName: data.agentName,
              },
              message: `Another tab updated the ${config.agentType} agent (${data.agentName}) at ${new Date(data.timestamp).toLocaleTimeString()}. Refresh this tab to see the latest changes.`,
            });
          }
        } catch (err) {
          console.error('[Multi-Tab] Error parsing storage event:', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [config.agentType]);

  // Broadcast save event to other tabs
  const broadcastSave = useCallback(() => {
    lastSaveRef.current = Date.now();

    if (broadcastChannelRef.current) {
      // Use BroadcastChannel if available
      broadcastChannelRef.current.postMessage({
        type: 'save',
        tabId: tabIdRef.current,
        timestamp: lastSaveRef.current,
        agentName: config.agentName,
      });
    } else {
      // Fallback to localStorage
      const storageKey = `agent-config-${config.agentType}-save`;
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          tabId: tabIdRef.current,
          timestamp: lastSaveRef.current,
          agentName: config.agentName,
        })
      );
    }
  }, [config.agentType, config.agentName]);

  // Clear conflict state
  const clearConflict = useCallback(() => {
    setConflict({
      hasConflict: false,
      message: '',
    });
  }, []);

  // Check if save is allowed (not blocked by conflict)
  const canSave = useCallback((): boolean => {
    return !conflict.hasConflict;
  }, [conflict.hasConflict]);

  return {
    // State
    hasConflict: conflict.hasConflict,
    conflictMessage: conflict.message,
    conflictingTab: conflict.conflictingTab,

    // Methods
    broadcastSave,
    clearConflict,
    canSave,
    getTabId: () => tabIdRef.current,
  };
}

// Utility: Detect if current tab is active
export function useTabVisibility() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return isVisible;
}
