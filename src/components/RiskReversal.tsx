"use client";

import { ShieldCheck, Undo2 } from "lucide-react";

export default function RiskReversal() {
    return (
        <section className="py-20 bg-slate-900 border-t border-slate-800">
            <div className="container mx-auto px-4">
                <div className="max-w-4xl mx-auto bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border border-cyan-500/20 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
                    {/* Background Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />

                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-cyan-500/20">
                            <ShieldCheck className="w-8 h-8 text-cyan-400" />
                        </div>

                        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                            The &quot;Zero-Patient&quot; Guarantee
                        </h2>

                        <p className="text-slate-300 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
                            Try Voxanne in your clinic for 30 days. If she doesn&apos;t capture at least <strong className="text-white">one new patient booking</strong> that you would have otherwise missed, we will refund 100% of your subscription.
                        </p>

                        <div className="flex flex-col md:flex-row items-center justify-center gap-6 text-sm text-slate-400">
                            <div className="flex items-center gap-2">
                                <Undo2 className="w-4 h-4 text-cyan-400" />
                                <span>Full Refund Policy</span>
                            </div>
                            <div className="hidden md:block w-1 h-1 bg-slate-700 rounded-full" />
                            <div>
                                No Long-Term Contracts
                            </div>
                            <div className="hidden md:block w-1 h-1 bg-slate-700 rounded-full" />
                            <div>
                                Cancel Anytime
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
