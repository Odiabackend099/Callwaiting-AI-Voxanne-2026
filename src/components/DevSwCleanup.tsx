'use client';

import { useEffect } from 'react';

export default function DevSwCleanup() {
  useEffect(() => {
    try {
      const host = window.location.hostname;
      const isLocal = host === 'localhost' || host === '127.0.0.1';
      if (!isLocal) return;

      const run = async () => {
        let changed = false;

        // Unregister all service workers
        if ('serviceWorker' in navigator) {
          try {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs) {
              const ok = await reg.unregister().catch(() => false);
              if (ok) {
                console.log('[DevSwCleanup] Unregistered service worker');
                changed = true;
              }
            }
          } catch (e) {
            console.error('[DevSwCleanup] Error unregistering SW:', e);
          }
        }

        // Clear all caches
        if ('caches' in window) {
          try {
            const keys = await caches.keys().catch(() => [] as string[]);
            for (const k of keys) {
              const ok = await caches.delete(k).catch(() => false);
              if (ok) {
                console.log('[DevSwCleanup] Cleared cache:', k);
                changed = true;
              }
            }
          } catch (e) {
            console.error('[DevSwCleanup] Error clearing caches:', e);
          }
        }

        // Clear IndexedDB (Workbox stores metadata here)
        if ('indexedDB' in window) {
          try {
            const dbs = await (window.indexedDB as any).databases?.() || [];
            for (const db of dbs) {
              if (db.name?.includes('workbox') || db.name?.includes('cache')) {
                window.indexedDB.deleteDatabase(db.name);
                console.log('[DevSwCleanup] Deleted IndexedDB:', db.name);
                changed = true;
              }
            }
          } catch (e) {
            // IndexedDB.databases() not supported in all browsers
          }
        }

        if (changed) {
          console.log('[DevSwCleanup] Changes detected, reloading page');
          setTimeout(() => {
            try {
              window.location.reload();
            } catch {
              // ignore
            }
          }, 100);
        }
      };

      void run();
    } catch (e) {
      console.error('[DevSwCleanup] Error:', e);
    }
  }, []);

  return null;
}
