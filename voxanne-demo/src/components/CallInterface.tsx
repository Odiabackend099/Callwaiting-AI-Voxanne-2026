
import React from 'react';
import { AbsoluteFill, Img, useVideoConfig } from 'remotion';

export const CallInterface: React.FC<{
    isActive: boolean;
}> = ({ isActive }) => {
    return (
        <AbsoluteFill className="bg-slate-50 flex flex-row">
            {/* Left Side: Clinical Trust Branding / Context */}
            <div className="w-1/3 h-full bg-white border-r border-slate-200 flex flex-col p-12 justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-12">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">V</div>
                        <span className="text-2xl font-bold text-slate-900">Voxanne AI</span>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Status</h3>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                                <span className="text-slate-700 font-medium">Live Call in Progress</span>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Caller ID</h3>
                            <p className="text-xl text-slate-900 font-medium">Anna (Patient)</p>
                            <p className="text-slate-500">+1 (555) 123-4567</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-blue-800 text-sm font-medium mb-1">AI Agent Logic</p>
                    <div className="text-blue-600 text-xs">
                        Thinking... <br />
                        Analyzing Intent: Booking<br />
                        Sentiment: Positive
                    </div>
                </div>
            </div>

            {/* Right Side: Dynamic Visualizer Area */}
            <div className="w-2/3 h-full relative flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="absolute inset-0 opacity-30"
                    style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
                </div>

                {/* Central AI Avatar Visualization */}
                <div className="relative z-10">
                    <div className="w-64 h-64 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 p-1 shadow-2xl shadow-blue-500/30 animate-[spin_10s_linear_infinite]">
                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden relative">
                            {/* Placeholder for Avatar Image or Waveform */}
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-blue-50/50"></div>
                            <span className="text-4xl">🎙️</span>
                        </div>
                    </div>

                    {/* Ring Animations */}
                    <div className="absolute inset-0 -z-10 rounded-full border border-blue-200 scale-150 opacity-20 animate-ping"></div>
                    <div className="absolute inset-0 -z-10 rounded-full border border-blue-400 scale-125 opacity-10 animate-pulse"></div>
                </div>
            </div>
        </AbsoluteFill>
    );
};
