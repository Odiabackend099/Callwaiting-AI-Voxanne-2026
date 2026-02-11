"use client";

import { ShieldCheck, Undo2 } from "lucide-react";

export default function RiskReversal() {
    return (
        <section className="py-20 bg-surgical-50 border-t border-surgical-200">
            <div className="container mx-auto px-4">
                <div className="max-w-4xl mx-auto bg-white border border-surgical-200 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden shadow-lg">
                    {/* Background Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-surgical-100/50 blur-[100px] rounded-full pointer-events-none" />

                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-surgical-100/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-surgical-200">
                            <ShieldCheck className="w-8 h-8 text-surgical-600" />
                        </div>

                        <h2 className="text-2xl md:text-3xl font-bold text-obsidian mb-4">
                            The &quot;Zero-Patient&quot; Guarantee
                        </h2>

                        <p className="text-obsidian/70 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
                            Try Voxanne AI in your clinic for 30 days. If she doesn&apos;t capture at least <strong className="text-obsidian">one new patient booking</strong> that you would have otherwise missed, we will refund 100% of your subscription.
                        </p>

                        <div className="flex flex-col md:flex-row items-center justify-center gap-6 text-sm text-obsidian/60">
                            <div className="flex items-center gap-2">
                                <Undo2 className="w-4 h-4 text-surgical-600" />
                                <span>Full Refund Policy</span>
                            </div>
                            <div className="hidden md:block w-1 h-1 bg-surgical-300 rounded-full" />
                            <div>
                                No Long-Term Contracts
                            </div>
                            <div className="hidden md:block w-1 h-1 bg-surgical-300 rounded-full" />
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
