"use client";

import FadeIn from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Check, Play, Pause, Calendar } from "lucide-react";
import HeroChatAnimation from "@/components/HeroChatAnimation";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export default function Hero() {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const toggleAudio = () => {
        if (!audioRef.current) return;
        
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleEnded = () => setIsPlaying(false);
        audio.addEventListener('ended', handleEnded);
        return () => audio.removeEventListener('ended', handleEnded);
    }, []);

    return (
        <section className="relative bg-gradient-to-b from-white via-slate-50/50 to-white pt-32 pb-24 overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
                {/* Left Column: Copy & CTA */}
                <div className="relative z-10 flex flex-col items-center lg:items-start text-center lg:text-left">
                    <FadeIn>
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-surgical-50 border border-surgical-100 rounded-full text-sm font-semibold text-surgical-700 mb-8 shadow-sm">
                            <ShieldCheck className="h-4 w-4" />
                            UK GDPR & HIPAA Compliant AI Receptionist
                        </span>
                    </FadeIn>

                    <FadeIn delay={0.1}>
                        <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-navy-900 leading-[1.1] mb-6">
                            The AI Front Desk for <br className="hidden lg:block" />
                            <span className="bg-gradient-to-r from-surgical-600 via-surgical-500 to-surgical-700 bg-clip-text text-transparent animate-gradient-x bg-[length:200%_auto]">
                                Modern Clinics.
                            </span>
                        </h1>
                    </FadeIn>

                    <FadeIn delay={0.2}>
                        <p className="text-xl text-slate-600 leading-relaxed max-w-lg mb-10">
                            Automate scheduling, answer patient queries, and reduce admin
                            overhead with voice AI that sounds human, integrates with your calendar,
                            and never misses a call.
                        </p>
                    </FadeIn>

                    <FadeIn delay={0.3} className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                        <Link href="/start">
                            <Button size="lg" className="w-full sm:w-auto bg-surgical-600 hover:bg-surgical-700 text-white text-lg h-14 px-8 shadow-xl shadow-surgical-500/20 rounded-full transition-all hover:scale-105 active:scale-95">
                                <Calendar className="mr-2 h-5 w-5" />
                                Get Started
                            </Button>
                        </Link>
                        
                        <Button 
                            size="lg" 
                            variant="outline" 
                            className={`w-full sm:w-auto text-lg h-14 px-8 border-slate-200 text-slate-700 hover:bg-slate-50 rounded-full transition-all ${isPlaying ? 'border-surgical-200 bg-surgical-50 text-surgical-700' : ''}`}
                            onClick={toggleAudio}
                        >
                            {isPlaying ? (
                                <>
                                    <Pause className="mr-2 h-5 w-5 fill-current" />
                                    Pause Demo
                                </>
                            ) : (
                                <>
                                    <Play className="mr-2 h-5 w-5 fill-current" />
                                    Hear Voxanne in Action
                                </>
                            )}
                        </Button>
                        <audio ref={audioRef} src="/audio/hero_conversation.mp3" className="hidden" />
                    </FadeIn>

                    <FadeIn delay={0.4} className="mt-10 flex flex-wrap justify-center lg:justify-start gap-x-8 gap-y-4 text-sm text-slate-500 font-medium">
                        <div className="flex items-center gap-2">
                            <div className="bg-green-100 rounded-full p-1">
                                <Check className="h-3 w-3 text-green-600" />
                            </div>
                            <span>Setup in 15 mins</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="bg-green-100 rounded-full p-1">
                                <Check className="h-3 w-3 text-green-600" />
                            </div>
                            <span>No credit card required</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="bg-green-100 rounded-full p-1">
                                <Check className="h-3 w-3 text-green-600" />
                            </div>
                            <span>Cancel anytime</span>
                        </div>
                    </FadeIn>
                </div>

                {/* Right Column: Interactive Chat Animation */}
                <FadeIn delay={0.4} className="relative flex items-center justify-center lg:justify-end">
                    {/* Glow Effect */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-surgical-500/20 rounded-full blur-[100px] -z-10" />
                    
                    <div className="relative transform lg:rotate-[-2deg] hover:rotate-0 transition-transform duration-500 ease-out">
                        <HeroChatAnimation />
                        
                        {/* Floating Badge */}
                        <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-xl border border-slate-100 flex items-center gap-3 animate-bounce-slow max-w-[200px]">
                            <div className="bg-green-100 p-2 rounded-lg">
                                <Calendar className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-navy-900">APPOINTMENT BOOKED</p>
                                <p className="text-[10px] text-slate-500">Synced to your calendar</p>
                            </div>
                        </div>
                    </div>
                </FadeIn>
            </div>
        </section>
    );
}
