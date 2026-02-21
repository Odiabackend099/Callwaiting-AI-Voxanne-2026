// Voxanne Brand Design Tokens
// Extracted from brand assets: 9.png color bars, 8.png typography

export const COLORS = {
    primary: '#2563EB',        // Voxanne Blue (Royal Blue from "Get Started" button)
    dark: '#0F172A',           // Deep Navy/Slate (1st bar in 9.png)
    light: '#F8FAFC',          // Off-white background
    glass: 'rgba(15, 23, 42, 0.6)',  // Glassmorphism dark tint
    glassBorder: 'rgba(255, 255, 255, 0.08)', // Subtle glass border
    accent: '#60A5FA',         // Light blue accent for waveform glow
    success: '#22C55E',        // Green for "live" indicator
};

export const FONT_FAMILY = "'Outfit', sans-serif";

// Video timing constants (30fps)
export const FPS = 30;
export const PHASE_A_END_SEC = 26;     // Intro ends at 26s
export const PHASE_B_END_SEC = 135;    // Chat overlay ends at 135s
export const TOTAL_DURATION_SEC = 148; // 2:28 total
export const TOTAL_FRAMES = TOTAL_DURATION_SEC * FPS; // 4440

// Convert seconds to frames
export const secToFrames = (sec: number) => Math.round(sec * FPS);
