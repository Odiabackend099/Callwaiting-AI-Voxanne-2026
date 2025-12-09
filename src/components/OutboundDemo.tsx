"use strict";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Check, Loader2, ArrowRight } from "lucide-react";

export default function OutboundDemo() {
    const [phone, setPhone] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");

    const handleCall = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus("loading");
        setErrorMessage("");

        try {
            const res = await fetch("/api/trigger-call", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    to: phone,
                    owner_name: "Dr. Smith", // Default context
                    clinic_name: "CallWaiting Demo Clinic"
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to trigger call");
            }

            setStatus("success");
        } catch (error: any) {
            setStatus("error");
            setErrorMessage(error.message);
        }
    };

    return (
        <div className="flex flex-col items-center gap-4 w-full max-w-md mx-auto">
            <AnimatePresence mode="wait">
                {status === "success" ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-2 text-green-400 bg-green-900/20 px-6 py-3 rounded-full border border-green-500/30"
                    >
                        <Check className="w-5 h-5" />
                        <span className="font-medium">Calling you now... pick up!</span>
                    </motion.div>
                ) : (
                    <form onSubmit={handleCall} className="relative flex items-center w-full">
                        <div className="absolute left-4 text-slate-400">
                            <Phone className="w-5 h-5" />
                        </div>
                        <input
                            type="tel"
                            placeholder="+1 (555) 000-0000"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            disabled={status === "loading"}
                            className="w-full pl-12 pr-36 py-4 bg-white/5 border border-white/10 rounded-full text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all backdrop-blur-sm"
                            required
                        />
                        <button
                            type="submit"
                            disabled={status === "loading" || !phone}
                            className="absolute right-2 top-2 bottom-2 px-6 bg-white text-black rounded-full font-semibold hover:bg-cyan-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {status === "loading" ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <span>Call Me</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>
                )}
            </AnimatePresence>

            {status === "error" && (
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-red-400 text-sm"
                >
                    {errorMessage}
                </motion.p>
            )}
        </div>
    );
}
