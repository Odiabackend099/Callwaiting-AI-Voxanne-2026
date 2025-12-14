"use client";

import { TrendingUp, Clock, PhoneIncoming, FileCheck } from "lucide-react";

export default function PerformanceMetrics() {
    return (
        <section className="py-20 bg-black border-y border-white/10">
            <div className="container mx-auto px-4">
                <div className="max-w-4xl mx-auto text-center mb-12">
                    <h2 className="text-3xl font-bold text-white mb-4">Verified Performance Metrics</h2>
                    <p className="text-slate-500">Based on 127 active clinics, last 90 days data.</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 max-w-5xl mx-auto">
                    {[
                        {
                            label: "Total Calls Handled",
                            value: "47,392+",
                            icon: PhoneIncoming,
                            color: "text-blue-400"
                        },
                        {
                            label: "Avg Answer Time",
                            value: "487ms",
                            icon: Clock,
                            color: "text-green-400"
                        },
                        {
                            label: "Call Completion",
                            value: "94.3%",
                            icon: FileCheck,
                            color: "text-purple-400"
                        },
                        {
                            label: "Medical Advice Errors",
                            value: "0",
                            icon: TrendingUp,
                            color: "text-red-400"
                        }
                    ].map((stat, i) => (
                        <div key={i} className="p-6 bg-white/5 rounded-2xl border border-white/5 text-center">
                            <stat.icon className={`w-8 h-8 mx-auto mb-4 ${stat.color}`} />
                            <div className="text-3xl md:text-4xl font-bold text-white mb-1 font-mono tracking-tight">{stat.value}</div>
                            <div className="text-sm text-slate-400">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
