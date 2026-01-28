"use client";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/Section";
import { motion, useScroll, useTransform } from "framer-motion";
import { CheckCircle2, Play } from "lucide-react";
import { useRef } from "react";

const easeOutExpo: [number, number, number, number] = [0.19, 1, 0.22, 1];

const fadeInUp = {
    hidden: { opacity: 0, y: 12 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.8, ease: easeOutExpo }
    }
};

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1
        }
    }
};

const maskedReveal = {
    hidden: { y: "100%" },
    visible: {
        y: "0%",
        transition: { duration: 0.8, ease: easeOutExpo }
    }
};

export function Hero() {
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start start", "end start"]
    });

    const parallaxY = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);

    return (
        <Section className="pt-20 pb-20 md:pt-32 md:pb-32 bg-gradient-to-b from-white to-slate-50/50 overflow-hidden" id="hero">
            <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center" ref={ref}>
                {/* Left Content */}
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={staggerContainer}
                >
                    <motion.div variants={fadeInUp}>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surgical-50 text-surgical-600 text-xs font-semibold uppercase tracking-wide mb-6 border border-surgical-100">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-surgical-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-surgical-500"></span>
                            </span>
                            Now Available for Beta Access
                        </div>
                    </motion.div>

                    <div className="mb-6 overflow-hidden">
                        <motion.h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-navy-900 leading-tight" variants={maskedReveal}>
                            The Voice of Your Business, <span className="text-surgical-600 block mt-2">Powered by Intelligence.</span>
                        </motion.h1>
                    </div>

                    <motion.p className="text-lg text-slate-600 mb-8 leading-relaxed max-w-lg" variants={fadeInUp}>
                        Voxanne AI is the next-gen receptionist developed by Call Waiting AI. Zero-latency. 24/7 booking. HIPAA Compliant.
                    </motion.p>

                    <motion.div className="flex flex-col sm:flex-row gap-4 mb-10" variants={fadeInUp}>
                        <Button className="bg-surgical-600 hover:bg-surgical-700 active:scale-95 text-white rounded-pill h-14 px-8 text-lg shadow-xl shadow-surgical-500/20 transition-all hover:scale-105 duration-300">
                            Get Started
                        </Button>
                        <Button variant="outline" className="rounded-pill h-14 px-8 text-lg border-slate-200 text-navy-900 hover:bg-slate-50 hover:text-surgical-600 gap-2 group active:scale-95 transition-all duration-300">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-surgical-50 text-surgical-600 group-hover:bg-surgical-600 group-hover:text-white transition-colors">
                                <Play className="w-3 h-3 fill-current" />
                            </span>
                            Hear Samples
                        </Button>
                    </motion.div>

                    <motion.div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-slate-500 font-medium" variants={fadeInUp}>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-surgical-600" />
                            <span>HIPAA Compliant</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-surgical-600" />
                            <span>Zero Latency</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-surgical-600" />
                            <span>24/7 Availability</span>
                        </div>
                    </motion.div>
                </motion.div>

                {/* Right Image/Card with Parallax */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1.2, ease: easeOutExpo, delay: 0.2 }}
                    style={{ y: parallaxY }} // Parallax Effect
                    className="relative hidden md:block"
                >
                    {/* Placeholder for Medical Reception Image */}
                    <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200 bg-slate-100 aspect-[4/3] group">
                        {/* Abstract Medical Background */}
                        <div className="absolute inset-0 bg-slate-200">
                            <div className="absolute inset-0 bg-gradient-to-tr from-slate-100 to-slate-300 opacity-50"></div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-300 text-6xl font-thin tracking-widest opacity-20 rotate-[-15deg]">
                                VOXANNE
                            </div>
                        </div>

                        {/* Floating UI Cards with Micro-Interactions */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.8, duration: 0.8, ease: easeOutExpo }}
                            className="absolute top-12 right-[-20px] bg-white p-4 rounded-xl shadow-lg border border-slate-100 w-64 z-10 hover:shadow-xl hover:border-surgical-200 transition-all duration-300 hover:scale-[1.02]"
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-xs font-semibold text-navy-900">Incoming Call</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded w-3/4 mb-1"></div>
                            <div className="h-2 bg-slate-100 rounded w-1/2"></div>
                        </motion.div>

                        <motion.div
                            initial={{ y: 40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 1, duration: 0.8, ease: easeOutExpo }}
                            className="absolute bottom-12 left-8 right-8 bg-white/95 backdrop-blur-md p-5 rounded-xl shadow-xl border border-slate-100 z-20 hover:shadow-2xl hover:border-surgical-200 transition-all duration-300 hover:scale-[1.01]"
                        >
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-bold text-navy-900 text-base">Appointment Confirmed</p>
                                    <p className="text-sm text-slate-500">Dr. Sarah Smith • Tomorrow, 2:00 PM</p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </motion.div>
            </div>
        </Section>
    );
}
