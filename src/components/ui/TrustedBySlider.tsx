'use client';

import React from 'react';
import { motion } from 'framer-motion';

const LOGOS = [
    { name: 'Twilio', icon: '💬' },
    { name: 'VAPI', icon: '🎙️' },
    { name: 'OpenAI', icon: '🤖' },
    { name: 'Google Cloud', icon: '☁️' },
    { name: 'AWS', icon: '📦' },
    { name: 'Azure', icon: '🔷' },
    { name: 'Epic', icon: '🏥' },
    { name: 'Oracle Health', icon: '⚕️' },
];

export const TrustedBySlider: React.FC = () => {
    return (
        <div className="w-full py-12 bg-white border-y border-slate-100 overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 mb-8 text-center">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                    Trusted by leading healthcare innovators
                </p>
            </div>

            <div className="relative flex overflow-x-hidden group">
                <div className="flex animate-marquee whitespace-nowrap">
                    {[...LOGOS, ...LOGOS, ...LOGOS].map((logo, idx) => (
                        <div
                            key={idx}
                            className="mx-8 flex items-center gap-3 text-slate-400 hover:text-navy-600 transition-colors duration-300"
                        >
                            <span className="text-2xl grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300">
                                {logo.icon}
                            </span>
                            <span className="text-xl font-bold font-display">{logo.name}</span>
                        </div>
                    ))}
                </div>

                <div className="absolute top-0 flex animate-marquee2 whitespace-nowrap">
                    {[...LOGOS, ...LOGOS, ...LOGOS].map((logo, idx) => (
                        <div
                            key={idx}
                            className="mx-8 flex items-center gap-3 text-slate-400 hover:text-navy-600 transition-colors duration-300"
                        >
                            <span className="text-2xl grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300">
                                {logo.icon}
                            </span>
                            <span className="text-xl font-bold font-display">{logo.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
