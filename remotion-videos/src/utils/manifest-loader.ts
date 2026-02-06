/**
 * Manifest Loader Utility
 *
 * Loads and queries JSON manifests containing DOM element coordinates
 * extracted via Playwright. Provides in-memory caching for performance.
 */

import { SceneManifest, ElementCoordinates } from '../types/manifest';

// In-memory cache for loaded manifests
const manifestCache: Record<string, SceneManifest> = {};

/**
 * Load a manifest file by screenshot name
 * @param screenshotName - Name of the screenshot (e.g., "00_signin_page.png")
 * @returns SceneManifest object or null if not found
 */
export function loadManifest(screenshotName: string): SceneManifest | null {
  // Check cache first
  if (manifestCache[screenshotName]) {
    return manifestCache[screenshotName];
  }

  try {
    // Load from public/manifests/ directory
    const manifestPath = `/manifests/${screenshotName.replace('.png', '.json')}`;
    const manifest = require(`../../public${manifestPath}`);

    // Cache for future use
    manifestCache[screenshotName] = manifest;
    return manifest;
  } catch (error) {
    console.warn(`⚠️  Manifest not found: ${screenshotName}`, error);
    return null;
  }
}

/**
 * Get a specific element's coordinates from a manifest
 * @param manifest - The loaded manifest object
 * @param elementName - Semantic name of the element (e.g., "email-input")
 * @returns ElementCoordinates object or null if not found
 */
export function getElement(
  manifest: SceneManifest | null,
  elementName: string
): ElementCoordinates | null {
  if (!manifest) return null;

  const element = manifest.elements.find(el => el.name === elementName);
  if (!element) {
    console.warn(`⚠️  Element "${elementName}" not found in manifest`);
  }
  return element || null;
}

/**
 * Convenience function to load manifest and get element coordinates in one call
 * @param screenshotName - Name of the screenshot (e.g., "00_signin_page.png")
 * @param elementName - Semantic name of the element (e.g., "email-input")
 * @returns ElementCoordinates object or null if not found
 */
export function getCoordinates(
  screenshotName: string,
  elementName: string
): ElementCoordinates | null {
  const manifest = loadManifest(screenshotName);
  return getElement(manifest, elementName);
}
