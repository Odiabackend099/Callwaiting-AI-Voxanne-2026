/**
 * TypeScript type definitions for automated coordinate extraction system
 *
 * This manifest system eliminates manual pixel measurements by extracting
 * DOM element coordinates via Playwright and storing them in JSON files.
 */

export interface ElementCoordinates {
  name: string;           // Semantic name: "email-input", "sign-in-button"
  selector: string;       // CSS selector used: 'input[type="email"]'
  x: number;              // Top-left X coordinate (pixels)
  y: number;              // Top-left Y coordinate (pixels)
  width: number;          // Element width (pixels)
  height: number;         // Element height (pixels)
  centerX: number;        // Calculated center X (for cursor positioning)
  centerY: number;        // Calculated center Y (for cursor positioning)
}

export interface SceneManifest {
  screenshotName: string;              // "00_signin_page.png"
  resolution: { width: number; height: number }; // 1920x1080
  capturedAt: string;                  // ISO timestamp
  elements: ElementCoordinates[];      // Array of extracted elements
}
