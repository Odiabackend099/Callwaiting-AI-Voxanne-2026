/**
 * Haptic Feedback Utility for PWA
 * Provides tactile feedback for mobile interactions
 * Uses Vibration API with fallback for unsupported browsers
 */

// Haptic patterns (in milliseconds)
const patterns = {
  light: [10],           // Quick tap feedback
  medium: [20],          // Standard button press
  heavy: [50],           // Important action
  success: [10, 50, 10, 50, 10],  // Success confirmation
  error: [50, 100, 50, 100, 50],  // Error notification
  warning: [30, 50, 30], // Warning notification
} as const;

type HapticPattern = keyof typeof patterns;

/**
 * Check if haptic feedback is supported
 */
function isSupported(): boolean {
  return 'vibrate' in navigator;
}

/**
 * Trigger haptic feedback with specified pattern
 */
function trigger(pattern: HapticPattern): void {
  if (!isSupported()) {
    return;
  }

  try {
    navigator.vibrate(patterns[pattern]);
  } catch (error) {
    console.warn('Haptic feedback failed:', error);
  }
}

/**
 * Stop all vibration
 */
function stop(): void {
  if (isSupported()) {
    navigator.vibrate(0);
  }
}

// Export convenience functions
export const haptics = {
  light: () => trigger('light'),
  medium: () => trigger('medium'),
  heavy: () => trigger('heavy'),
  success: () => trigger('success'),
  error: () => trigger('error'),
  warning: () => trigger('warning'),
  stop,
  isSupported,
};
