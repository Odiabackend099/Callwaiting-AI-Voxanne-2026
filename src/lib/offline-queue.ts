/**
 * Offline Form Queue Utility
 * Stores form submissions in IndexedDB when offline
 * Automatically syncs when connection is restored
 */

const DB_NAME = 'voxanne-offline-queue';
const STORE_NAME = 'pending-submissions';
const DB_VERSION = 1;

interface QueuedSubmission {
  id: string;
  formData: Record<string, any>;
  timestamp: number;
  retryCount: number;
}

/**
 * Open IndexedDB connection
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Add form submission to offline queue
 */
export async function queueSubmission(formData: FormData): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();

  // Convert FormData to plain object
  const data: Record<string, any> = {};
  formData.forEach((value, key) => {
    if (value instanceof File) {
      // Convert File to base64 for storage
      const reader = new FileReader();
      reader.readAsDataURL(value);
      reader.onload = () => {
        data[key] = {
          type: 'file',
          name: value.name,
          size: value.size,
          mimeType: value.type,
          data: reader.result,
        };
      };
    } else {
      data[key] = value;
    }
  });

  const submission: QueuedSubmission = {
    id,
    formData: data,
    timestamp: Date.now(),
    retryCount: 0,
  };

  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  await store.add(submission);

  console.log('[OfflineQueue] Queued submission:', id);
  return id;
}

/**
 * Get all pending submissions
 */
export async function getPendingSubmissions(): Promise<QueuedSubmission[]> {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Remove submission from queue
 */
export async function removeSubmission(id: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  await store.delete(id);
  console.log('[OfflineQueue] Removed submission:', id);
}

/**
 * Update retry count for submission
 */
export async function incrementRetryCount(id: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  const request = store.get(id);
  request.onsuccess = () => {
    const submission = request.result;
    if (submission) {
      submission.retryCount += 1;
      store.put(submission);
    }
  };
}

/**
 * Process queued submissions
 */
export async function processQueue(
  submitFn: (formData: FormData) => Promise<void>
): Promise<{ success: number; failed: number }> {
  const pending = await getPendingSubmissions();
  let success = 0;
  let failed = 0;

  console.log(`[OfflineQueue] Processing ${pending.length} queued submissions`);

  for (const submission of pending) {
    try {
      // Convert back to FormData
      const formData = new FormData();
      for (const [key, value] of Object.entries(submission.formData)) {
        if (value && typeof value === 'object' && value.type === 'file') {
          // Reconstruct File from base64
          const response = await fetch(value.data);
          const blob = await response.blob();
          const file = new File([blob], value.name, { type: value.mimeType });
          formData.append(key, file);
        } else {
          formData.append(key, value);
        }
      }

      // Attempt submission
      await submitFn(formData);
      await removeSubmission(submission.id);
      success++;
      console.log('[OfflineQueue] Successfully synced:', submission.id);
    } catch (error) {
      console.error('[OfflineQueue] Failed to sync:', submission.id, error);
      await incrementRetryCount(submission.id);
      failed++;

      // Remove after 3 failed attempts
      if (submission.retryCount >= 3) {
        console.warn('[OfflineQueue] Max retries reached, removing:', submission.id);
        await removeSubmission(submission.id);
      }
    }
  }

  return { success, failed };
}

/**
 * Get count of queued submissions
 */
export async function getQueuedCount(): Promise<number> {
  const pending = await getPendingSubmissions();
  return pending.length;
}

/**
 * Get queue status
 */
export async function getQueueStatus(): Promise<{
  count: number;
  oldestTimestamp: number | null;
}> {
  const pending = await getPendingSubmissions();
  const oldestTimestamp = pending.length > 0
    ? Math.min(...pending.map((s) => s.timestamp))
    : null;

  return {
    count: pending.length,
    oldestTimestamp,
  };
}
