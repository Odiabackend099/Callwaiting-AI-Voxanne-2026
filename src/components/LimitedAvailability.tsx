"use client";

import { AlertTriangle } from "lucide-react";

export default function LimitedAvailability() {
    return (
        <section className="py-12 bg-[#050505] border-t border-white/5">
            <div className="container mx-auto px-4">
                <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center gap-6 p-6 rounded-2xl bg-orange-500/5 border border-orange-500/20">
                    <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center animate-pulse">
                            <AlertTriangle className="w-6 h-6 text-orange-500" />
                        </div>
                    </div>

                    <div className="flex-1 text-center md:text-left">
                        <h3 className="text-lg font-bold text-orange-400 mb-1">
                            High Demand Alert
                        </h3>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Due to the verified medical nature of our onboarding, we can only accept <strong>5 new clinics per week</strong> to ensure safety compliance.
                        </p>
                    </div>

                    <div className="flex-shrink-0 text-center">
                        <div className="text-2xl font-bold text-white mb-1">2 / 5</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest">Spots Left This Week</div>
                    </div>
                </div>
            </div>
        </section>
    );
}
