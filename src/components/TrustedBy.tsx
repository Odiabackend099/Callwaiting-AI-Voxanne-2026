"use client";

import { Shield } from "lucide-react";

export default function TrustedBy() {
    return (
        <section className="py-12 border-y border-white/5 bg-black/40 backdrop-blur-sm overflow-hidden relative z-10">
            <div className="container mx-auto px-6">
                <p className="text-center text-xs font-bold text-zinc-500 mb-8 uppercase tracking-[0.2em]">Trusted by Top Aesthetic Clinics, Plastic Surgeons & Med Spas</p>

                <div className="relative flex overflow-x-hidden group">
                    <div className="animate-marquee flex gap-16 whitespace-nowrap py-4">
                        {[...Array(2)].map((_, i) => (
                            <div key={i} className="flex gap-16 items-center opacity-60 grayscale transition-all duration-500 hover:grayscale-0 hover:opacity-100">
                                <span className="flex items-center gap-2 text-2xl font-serif font-bold text-white"><Shield className="w-6 h-6 text-emerald-500" /> ELITE<span className="text-cyan-400">DERM</span></span>
                                <span className="flex items-center gap-2 text-2xl font-sans font-black text-white tracking-tighter"><Shield className="w-6 h-6 text-emerald-500" /> NOVA<span className="font-light">SCULPT</span></span>
                                <span className="flex items-center gap-2 text-2xl font-serif italic text-white"><Shield className="w-6 h-6 text-emerald-500" /> Lumiere</span>
                                <span className="flex items-center gap-2 text-2xl font-mono font-bold text-white"><Shield className="w-6 h-6 text-emerald-500" /> AESTHETICA</span>
                                <span className="flex items-center gap-2 text-2xl font-sans font-bold text-white"><Shield className="w-6 h-6 text-emerald-500" /> SKIN<span className="text-cyan-400">+</span></span>
                            </div>
                        ))}
                    </div>
                    {/* Clone for seamless loop */}
                    <div className="absolute top-0 animate-marquee2 flex gap-16 whitespace-nowrap py-4 pl-16">
                        {[...Array(2)].map((_, i) => (
                            <div key={i} className="flex gap-16 items-center opacity-60 grayscale transition-all duration-500 hover:grayscale-0 hover:opacity-100">
                                <span className="flex items-center gap-2 text-2xl font-serif font-bold text-white"><Shield className="w-6 h-6 text-emerald-500" /> ELITE<span className="text-cyan-400">DERM</span></span>
                                <span className="flex items-center gap-2 text-2xl font-sans font-black text-white tracking-tighter"><Shield className="w-6 h-6 text-emerald-500" /> NOVA<span className="font-light">SCULPT</span></span>
                                <span className="flex items-center gap-2 text-2xl font-serif italic text-white"><Shield className="w-6 h-6 text-emerald-500" /> Lumiere</span>
                                <span className="flex items-center gap-2 text-2xl font-mono font-bold text-white"><Shield className="w-6 h-6 text-emerald-500" /> AESTHETICA</span>
                                <span className="flex items-center gap-2 text-2xl font-sans font-bold text-white"><Shield className="w-6 h-6 text-emerald-500" /> SKIN<span className="text-cyan-400">+</span></span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="mt-10 text-center">
                    <p className="text-zinc-300 italic font-medium text-lg">&quot;Since installing Call Waiting AI, our after-hours consult bookings increased by 40%. She paid for herself in the first week.&quot;</p>
                    <p className="text-zinc-500 text-sm mt-3 font-semibold">– Dr. Sarah J., Board Certified Plastic Surgeon</p>
                </div>

                {/* Associations & Conferences */}
                <div className="mt-20 pt-10 border-t border-white/5 grid md:grid-cols-2 gap-12 text-center">
                    <div>
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6">Trusted by Members of</h4>
                        <div className="flex flex-wrap justify-center gap-6 text-zinc-400 font-semibold text-sm">
                            <span className="px-4 py-2 border border-white/10 rounded-full">ASPS</span>
                            <span className="px-4 py-2 border border-white/10 rounded-full">AmSpa</span>
                            <span className="px-4 py-2 border border-white/10 rounded-full">ISAPS</span>
                            <span className="px-4 py-2 border border-white/10 rounded-full">AAD</span>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6">Meet Us At</h4>
                        <div className="flex flex-wrap justify-center gap-6 text-cyan-400 font-medium text-sm">
                            <span className="flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> ASPS Annual '25</span>
                            <span className="flex items-center gap-2">IMCAS World</span>
                            <span className="flex items-center gap-2">AmSpa Show</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
