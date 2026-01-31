"use client";

import { Shield, FileCheck, Lock } from "lucide-react";
import { motion } from "framer-motion";

export function SafetyDisclaimer() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full max-w-3xl mx-auto mt-2 mb-8"
        >
            <div className="flex flex-col sm:flex-row items-center gap-3 text-sm text-slate-300 bg-white/5 border border-white/10 px-4 py-3 rounded-2xl backdrop-blur">
                <div className="flex items-center gap-2 font-semibold text-white">
                    <Shield className="w-4 h-4 text-cyan-300" />
                    Voxanne • Safe & Compliant
                </div>
                <p className="text-xs sm:text-sm text-slate-300 text-center sm:text-left flex-1">
                    Voxanne does not provide medical advice, diagnosis, or treatment. Clinical questions are routed to licensed staff.
                    UK GDPR & HIPAA certified with DPA and BAA included.
                </p>
                <div className="flex items-center gap-4 text-[11px] uppercase tracking-wide text-slate-400">
                    <span className="flex items-center gap-1">
                        <Lock className="w-3 h-3" /> GDPR
                    </span>
                    <span className="flex items-center gap-1">
                        <Lock className="w-3 h-3" /> HIPAA
                    </span>
                    <span className="flex items-center gap-1">
                        <FileCheck className="w-3 h-3" /> SOC2
                    </span>
                </div>
            </div>
        </motion.div>
    );
}
