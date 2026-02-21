import React from 'react';
import {
    useCurrentFrame,
    useVideoConfig,
    AbsoluteFill,
    OffthreadVideo,
    staticFile,
    Sequence,
    interpolate,
    spring,
    Easing,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Outfit';
import { ChatOverlay } from '../components/ChatOverlay';
import {
    COLORS,
    secToFrames,
    PHASE_A_END_SEC,
    PHASE_B_END_SEC,
    TOTAL_FRAMES,
} from '../constants';

const { fontFamily } = loadFont();

// Frame boundaries
const PHASE_A_END = secToFrames(PHASE_A_END_SEC);   // 780
const PHASE_B_END = secToFrames(PHASE_B_END_SEC);   // 4050

// Transition durations
const BLUR_IN_DURATION = 30;   // 1 second to blur in
const BLUR_OUT_DURATION = 30;  // 1 second to blur out
const OVERLAY_SLIDE_FRAMES = 45; // 1.5 seconds for slide animation

/**
 * TestimonialVideo — "The Immersive Overlay"
 *
 * Three-phase composition:
 *   Phase A (0s–26s):   Full-screen client video
 *   Phase B (26s–135s): Blurred video + Chat overlay
 *   Phase C (135s–148s): Full-screen reaction / outro
 *
 * Total: 4440 frames = 148s = 02:28 at 30fps
 * Format: 1080×1920 (vertical 9:16 for Shorts/Reels)
 */
export const TestimonialVideo: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // ─── Blur Transition ───────────────────────────────────────────────────────
    // Ramps from 0→8px as we enter Phase B, then 8px→0 exiting Phase B
    const blurIn = interpolate(
        frame,
        [PHASE_A_END, PHASE_A_END + BLUR_IN_DURATION],
        [0, 8],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    const blurOut = interpolate(
        frame,
        [PHASE_B_END - BLUR_OUT_DURATION, PHASE_B_END],
        [8, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    // Determine current blur value
    let blurAmount = 0;
    if (frame >= PHASE_A_END && frame < PHASE_A_END + BLUR_IN_DURATION) {
        blurAmount = blurIn;
    } else if (frame >= PHASE_A_END + BLUR_IN_DURATION && frame < PHASE_B_END - BLUR_OUT_DURATION) {
        blurAmount = 8;
    } else if (frame >= PHASE_B_END - BLUR_OUT_DURATION && frame < PHASE_B_END) {
        blurAmount = blurOut;
    }

    // ─── Scale Transition ──────────────────────────────────────────────────────
    // Video scales to 0.92 during Phase B (subtle zoom-out)
    const scaleIn = interpolate(
        frame,
        [PHASE_A_END, PHASE_A_END + BLUR_IN_DURATION],
        [1, 0.92],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    const scaleOut = interpolate(
        frame,
        [PHASE_B_END - BLUR_OUT_DURATION, PHASE_B_END],
        [0.92, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    let videoScale = 1;
    if (frame >= PHASE_A_END && frame < PHASE_A_END + BLUR_IN_DURATION) {
        videoScale = scaleIn;
    } else if (frame >= PHASE_A_END + BLUR_IN_DURATION && frame < PHASE_B_END - BLUR_OUT_DURATION) {
        videoScale = 0.92;
    } else if (frame >= PHASE_B_END - BLUR_OUT_DURATION && frame < PHASE_B_END) {
        videoScale = scaleOut;
    }

    // ─── Darkening overlay during Phase B ──────────────────────────────────────
    const darkenOpacity = interpolate(
        frame,
        [PHASE_A_END, PHASE_A_END + BLUR_IN_DURATION, PHASE_B_END - BLUR_OUT_DURATION, PHASE_B_END],
        [0, 0.3, 0.3, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    // ─── Phase C "HOPPA!" text flash ──────────────────────────────────────────
    const showReactionText = frame >= PHASE_B_END && frame < PHASE_B_END + 60;
    const reactionOpacity = showReactionText
        ? interpolate(
            frame,
            [PHASE_B_END, PHASE_B_END + 15, PHASE_B_END + 45, PHASE_B_END + 60],
            [0, 1, 1, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        )
        : 0;

    return (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
            {/* ── Layer 1: Source Video ──────────────────────────────────────────── */}
            <AbsoluteFill
                style={{
                    filter: `blur(${blurAmount}px)`,
                    transform: `scale(${videoScale})`,
                    transition: 'filter 0.03s ease',
                }}
            >
                <OffthreadVideo
                    src={staticFile('anna-demo.mp4')}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    }}
                />
            </AbsoluteFill>

            {/* ── Layer 2: Dark overlay during Phase B ──────────────────────────── */}
            <AbsoluteFill
                style={{
                    backgroundColor: 'rgba(0, 0, 0, 1)',
                    opacity: darkenOpacity,
                }}
            />

            {/* ── Layer 3: Chat Overlay (Phase B only) ──────────────────────────── */}
            <Sequence
                from={PHASE_A_END}
                durationInFrames={PHASE_B_END - PHASE_A_END + OVERLAY_SLIDE_FRAMES}
                layout="none"
            >
                <ChatOverlay />
            </Sequence>

            {/* ── Layer 4: Phase C reaction text ────────────────────────────────── */}
            {showReactionText && (
                <AbsoluteFill
                    style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        paddingBottom: '180px',
                        opacity: reactionOpacity,
                    }}
                >
                    <div
                        style={{
                            fontFamily,
                            fontSize: '36px',
                            fontWeight: 700,
                            color: 'white',
                            textAlign: 'center',
                            padding: '16px 40px',
                            borderRadius: '16px',
                            backgroundColor: 'rgba(37, 99, 235, 0.85)',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 8px 32px rgba(37, 99, 235, 0.4)',
                        }}
                    >
                        🤯 Real AI. Real Call. Real Results.
                    </div>
                </AbsoluteFill>
            )}

            {/* ── Layer 5: Voxanne watermark ────────────────────────────────────── */}
            <div
                style={{
                    position: 'absolute',
                    top: '50px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontFamily,
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'rgba(255, 255, 255, 0.4)',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    zIndex: 100,
                }}
            >
                Voxanne AI
            </div>
        </AbsoluteFill>
    );
};
