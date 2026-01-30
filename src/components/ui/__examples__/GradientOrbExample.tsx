"use client";

import { GradientOrb } from "../GradientOrb";

/**
 * Example usage of GradientOrb component
 *
 * This component demonstrates various configurations of the GradientOrb
 * for parallax backgrounds and visual depth effects.
 */
export default function GradientOrbExample() {
    return (
        <div className="min-h-screen bg-navy-900 relative overflow-hidden">
            {/* Background gradient orbs for depth */}
            <GradientOrb
                position="top-right"
                color="blue-bright"
                opacity={0.3}
                size={500}
                blur={150}
            />

            <GradientOrb
                position="bottom-left"
                color="blue-medium"
                opacity={0.2}
                size={400}
                blur={120}
                animationDuration={10}
            />

            <GradientOrb
                position="center"
                color="blue-light"
                opacity={0.15}
                size={600}
                blur={180}
                animationDuration={12}
            />

            {/* Content with higher z-index */}
            <div className="relative z-10 container mx-auto px-4 py-20">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-6xl font-bold text-white mb-6">
                        GradientOrb Component
                    </h1>

                    <p className="text-xl text-slate-300 mb-8">
                        Animated gradient backgrounds for parallax effects with
                        GPU-accelerated animations and accessibility support.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Example card 1 */}
                        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                            <h3 className="text-2xl font-semibold text-white mb-3">
                                Top Right Orb
                            </h3>
                            <p className="text-slate-400">
                                Blue-bright color at 0.3 opacity with 500px size
                                and 150px blur. 8-second animation loop.
                            </p>
                        </div>

                        {/* Example card 2 */}
                        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                            <h3 className="text-2xl font-semibold text-white mb-3">
                                Bottom Left Orb
                            </h3>
                            <p className="text-slate-400">
                                Blue-medium color at 0.2 opacity with 400px size
                                and 120px blur. 10-second animation loop.
                            </p>
                        </div>

                        {/* Example card 3 */}
                        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                            <h3 className="text-2xl font-semibold text-white mb-3">
                                Center Orb
                            </h3>
                            <p className="text-slate-400">
                                Blue-light color at 0.15 opacity with 600px size
                                and 180px blur. 12-second animation loop.
                            </p>
                        </div>

                        {/* Example card 4 */}
                        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                            <h3 className="text-2xl font-semibold text-white mb-3">
                                Performance
                            </h3>
                            <p className="text-slate-400">
                                GPU-accelerated with transform + opacity.
                                Respects prefers-reduced-motion for accessibility.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
