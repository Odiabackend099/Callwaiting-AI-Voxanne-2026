"use client";

import { motion } from "framer-motion";
import { Play, Volume2 } from "lucide-react";
import { useState, useRef } from "react";

export default function SampleCallPlayer() {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    return (
        <section className="py-24 bg-slate-950">
            <div className="container mx-auto px-4">
                <div className="max-w-4xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="text-center mb-12"
                    >
                        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                            Listen to a Real Call
                        </h2>
                        <p className="text-slate-400 text-lg">
                            Hear Roxanne handle a BBL inquiry from start to booking.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-12 border border-white/10"
                    >
                        {/* Audio Player */}
                        <div className="flex items-center gap-6 mb-8">
                            <button
                                onClick={togglePlay}
                                className="w-20 h-20 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-cyan-500/30"
                            >
                                {isPlaying ? (
                                    <div className="w-6 h-6 flex gap-1.5">
                                        <div className="w-2 bg-white rounded"></div>
                                        <div className="w-2 bg-white rounded"></div>
                                    </div>
                                ) : (
                                    <Play className="w-8 h-8 text-white ml-1" fill="white" />
                                )}
                            </button>

                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <Volume2 className="w-5 h-5 text-cyan-400" />
                                    <span className="text-white font-bold">BBL Consultation Call</span>
                                </div>
                                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full w-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-300"></div>
                                </div>
                                <div className="flex justify-between text-xs text-slate-500 mt-1">
                                    <span>0:00</span>
                                    <span>1:00</span>
                                </div>
                            </div>
                        </div>

                        {/* Transcript */}
                        <div className="bg-black/30 rounded-2xl p-6 border border-white/5">
                            <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                Live Transcript
                            </h4>
                            <div className="space-y-4 text-sm">
                                <div>
                                    <span className="text-cyan-400 font-medium">Roxanne:</span>
                                    <span className="text-slate-300 ml-2">
                                        "Good afternoon, you've reached Dr. Chen's cosmetic surgery practice. This is Roxanne. How may I assist you today?"
                                    </span>
                                </div>
                                <div>
                                    <span className="text-purple-400 font-medium">Caller:</span>
                                    <span className="text-slate-300 ml-2">
                                        "Hi, I'm interested in getting a BBL. Can you tell me about pricing?"
                                    </span>
                                </div>
                                <div>
                                    <span className="text-cyan-400 font-medium">Roxanne:</span>
                                    <span className="text-slate-300 ml-2">
                                        "Absolutely! Dr. Chen's BBL packages start at £8,500. Have you had a consultation before?"
                                    </span>
                                </div>
                                <div className="text-slate-500 italic text-center py-2">
                                    ... conversation continues ...
                                </div>
                            </div>
                        </div>

                        {/* Hidden Audio Element */}
                        <audio
                            ref={audioRef}
                            src="/audio/demos/bbl-inquiry-pricing.wav"
                            onEnded={() => setIsPlaying(false)}
                            className="hidden"
                        />
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
