"use client";

import { PhoneForwarded, BrainCircuit, Activity, Lock, Stethoscope } from "lucide-react";

export default function SafetySection() {
    return (
        <section className="py-24 bg-[#0A0A0A] relative overflow-hidden" id="safety-section">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

            <div className="container mx-auto px-4 md:px-6 relative z-10">
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium mb-6">
                        <Lock className="w-4 h-4" />
                        <span>Liability Protection Active</span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                        Safety is NOT an Afterthought. <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
                            It&apos;s Hardcoded.
                        </span>
                    </h2>
                    <p className="text-slate-400 max-w-2xl mx-auto text-lg">
                        Voxanne AI is the only AI receptionist with &quot;Safe Mode&quot; — a breakdown-proof protocol that prevents medical liability while capturing revenue.
                    </p>
                </div>

                {/* Safe Mode Logic Visualization */}
                <div className="max-w-5xl mx-auto bg-slate-900/50 border border-white/10 rounded-3xl p-6 md:p-12 backdrop-blur-sm relative mb-20 w-full">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

                    <h3 className="text-2xl font-bold text-white mb-8 text-center flex items-center justify-center gap-3">
                        <BrainCircuit className="w-8 h-8 text-cyan-500" />
                        The Handoff Logic
                    </h3>

                    <div className="grid md:grid-cols-4 gap-4 relative">
                        {/* Connecting Line */}
                        <div className="hidden md:block absolute top-[2.5rem] left-[12%] right-[12%] h-0.5 bg-slate-800 -z-10" />

                        {/* Step 1: Call Received */}
                        <div className="flex flex-col items-center text-center">
                            <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center mb-4 z-10">
                                <PhoneForwarded className="w-10 h-10 text-white" />
                            </div>
                            <h4 className="font-bold text-white mb-2">Call Received</h4>
                            <p className="text-xs text-slate-400">Answers in 500ms</p>
                        </div>

                        {/* Step 2: Intent Analysis */}
                        <div className="flex flex-col items-center text-center">
                            <div className="w-20 h-20 rounded-2xl bg-cyan-900/20 border border-cyan-500/30 flex items-center justify-center mb-4 z-10 animate-pulse">
                                <BrainCircuit className="w-10 h-10 text-cyan-400" />
                            </div>
                            <h4 className="font-bold text-cyan-400 mb-2">Intent Check</h4>
                            <p className="text-xs text-slate-400">Real-time Safety Scan</p>
                        </div>

                        {/* Step 3: Branching Logic */}
                        <div className="col-span-2 grid grid-rows-3 gap-3">
                            {/* Path A: Booking */}
                            <div className="flex items-center gap-4 bg-green-500/5 border border-green-500/10 p-4 rounded-xl">
                                <Activity className="w-5 h-5 text-green-500 flex-shrink-0" />
                                <div className="text-left">
                                    <p className="text-green-400 font-bold text-sm">Booking/Inquiry (Safe)</p>
                                    <p className="text-slate-500 text-xs text-left">→ Checks calendar → Confirms appointment</p>
                                </div>
                            </div>

                            {/* Path B: Pricing */}
                            <div className="flex items-center gap-4 bg-yellow-500/5 border border-yellow-500/10 p-4 rounded-xl">
                                <div className="text-yellow-500 font-bold text-lg w-5 text-center flex-shrink-0">£</div>
                                <div className="text-left">
                                    <p className="text-yellow-400 font-bold text-sm">Pricing Question (Caution)</p>
                                    <p className="text-slate-500 text-xs text-left">→ Gives range w/ disclaimer → Books consult</p>
                                </div>
                            </div>

                            {/* Path C: Medical/Emergency */}
                            <div className="flex items-center gap-4 bg-red-500/5 border border-red-500/20 p-4 rounded-xl relative overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 animate-pulse" />
                                <Stethoscope className="w-5 h-5 text-red-500 flex-shrink-0" />
                                <div className="text-left">
                                    <p className="text-red-400 font-bold text-sm">Medical/Emergency (Danger)</p>
                                    <p className="text-slate-400 text-xs text-left">→ <span className="text-red-400 font-bold uppercase">Immediate Transfer to Staff</span></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Feature Grid */}
                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {[
                        {
                            title: "Zero Medical Advice",
                            desc: "Voxanne AI is hardcoded to never diagnose or prescribe. She deflects medical questions to your team 100% of the time.",
                            colors: "border-red-500/20 hover:border-red-500/40"
                        },
                        {
                            title: "Emergency Detection",
                            desc: "Keywords like 'bleeding', 'pain', or 'allergic' trigger an instant interrupt and transfer to your emergency line.",
                            colors: "border-orange-500/20 hover:border-orange-500/40"
                        },
                        {
                            title: "Liability Recording",
                            desc: "Every call is recorded, transcribed, and timestamped. You have absolute proof of exactly what was said.",
                            colors: "border-blue-500/20 hover:border-blue-500/40"
                        }
                    ].map((item, i) => (
                        <div key={i} className={`p-8 bg-black border ${item.colors} rounded-2xl transition-all hover:-translate-y-1`}>
                            <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                            <p className="text-slate-400 leading-relaxed text-sm">{item.desc}</p>
                        </div>
                    ))}
                </div>

            </div>
        </section>
    );
}
