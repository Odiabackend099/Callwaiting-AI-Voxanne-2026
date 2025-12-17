import { getIntegrationSettings } from '../routes/founder-console-settings';

let cachedSettings: any = null;
let lastFetch = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

export async function getCachedIntegrationSettings() {
    const now = Date.now();
    if (cachedSettings && (now - lastFetch < CACHE_TTL_MS)) {
        return cachedSettings;
    }

    try {
        const settings = await getIntegrationSettings();
        if (settings) {
            cachedSettings = settings;
            lastFetch = now;
        }
        return settings;
    } catch (error) {
        console.error('Error fetching integration settings:', error);
        // Return stale cache on error if available
        return cachedSettings || null;
    }
}
