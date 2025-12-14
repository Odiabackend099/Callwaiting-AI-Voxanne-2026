"use client";

import { Shield, FileCheck, Lock } from "lucide-react";
import { motion } from "framer-motion";

export function SafetyDisclaimer() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full max-w-2xl mx-auto mt-4 mb-8"
        >
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 sm:p-4 backdrop-blur-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                    <div className="flex-shrink-0 bg-red-500/10 p-2 rounded-full hidden sm:block">
                        <Shield className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-white text-sm font-semibold flex items-center gap-2 mb-1">
                            <Shield className="w-4 h-4 text-red-500 sm:hidden" />
                            ⚖️ SAFE & COMPLIANT
                        </h3>
                        <p className="text-slate-400 text-xs leading-relaxed">
                            Voxanne does not provide medical advice or diagnosis. All clinical questions are escalated
                            to your licensed staff. HIPAA/GDPR certified with BAA included.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 mt-3 sm:mt-0 w-full sm:w-auto border-t sm:border-t-0 border-slate-800 pt-3 sm:pt-0 justify-end">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                            <Lock className="w-3 h-3" />
                            HIPAA
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                            <FileCheck className="w-3 h-3" />
                            SOC2
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
