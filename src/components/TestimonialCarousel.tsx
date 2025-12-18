"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote, TrendingUp } from "lucide-react";
import Image from "next/image";

interface Testimonial {
    id: string;
    name: string;
    role: string;
    clinic: string;
    image: string;
    quote: string;
    metric: string;
}

const testimonials: Testimonial[] = [
    {
        id: "1",
        name: "Dr. Michael Chen",
        role: "Plastic Surgeon",
        clinic: "Chen Aesthetic Institute",
        image: "/images/testimonials/michael.png",
        quote: "Call Waiting AI isn't just an answering service. She captured roughly $120k in missed revenue in the first month alone. I can't imagine running my practice without her now.",
        metric: "+$120k/mo Revenue"
    },
    {
        id: "2",
        name: "Sarah Williams",
        role: "Marketing Director",
        clinic: "Elite MedSpa",
        image: "/images/testimonials/sarah.png",
        quote: "Our front desk was overwhelmed. Call Waiting AI took over 80% of the call load instantly. Our patient satisfaction scores went up because humans could focus on the people in the room.",
        metric: "80% Call Automation"
    },
    {
        id: "3",
        name: "Emma Davis",
        role: "Clinic Manager",
        clinic: "Lumiere Dermatology",
        image: "/images/testimonials/emma.png",
        quote: "Setup was incredibly easy. We were live in 20 minutes. It's like hiring a receptionist who never sleeps, never takes a break, and knows everything about our services.",
        metric: "24/7 Availability"
    }
];

export default function TestimonialCarousel() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        if (isPaused) return;

        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % testimonials.length);
        }, 6000);

        return () => clearInterval(timer);
    }, [isPaused]);

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
    };

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    };

    const current = testimonials[currentIndex];

    return (
        <div className="py-24 px-6 bg-slate-50 dark:bg-slate-900/50">
            <div className="container mx-auto max-w-6xl">
                {/* Header */}
                <div className="text-center mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold mb-6"
                    >
                        <TrendingUp className="w-4 h-4" />
                        Proven Results
                    </motion.div>
                    <h2 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 dark:text-white mb-4">
                        Trusted by Leading Clinics
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto">
                        See how top practices are using Call Waiting AI to grow revenue and delight patients.
                    </p>
                </div>

                {/* Carousel */}
                <div
                    className="relative"
                    onMouseEnter={() => setIsPaused(true)}
                    onMouseLeave={() => setIsPaused(false)}
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentIndex}
                            initial={{ opacity: 0, x: 100 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -100 }}
                            transition={{ duration: 0.3 }}
                            className="bg-white dark:bg-slate-800 rounded-3xl p-8 md:p-12 shadow-xl border border-slate-200 dark:border-slate-700"
                        >
                            <div className="flex flex-col md:flex-row gap-8 items-center">
                                {/* Image */}
                                <div className="relative shrink-0">
                                    <div className="w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl relative z-10">
                                        <Image
                                            src={current.image}
                                            alt={current.name}
                                            fill
                                            sizes="(max-width: 768px) 128px, 192px"
                                            className="object-cover"
                                        />
                                    </div>
                                    <div className="absolute -bottom-4 -right-4 bg-cyan-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg z-20">
                                        Verified
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 text-center md:text-left">
                                    <Quote className="w-10 h-10 text-cyan-500/20 mb-4 mx-auto md:mx-0" />
                                    <blockquote className="text-xl md:text-2xl font-serif text-slate-800 dark:text-slate-200 leading-relaxed mb-6">
                                        &quot;{current.quote}&quot;
                                    </blockquote>

                                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                                {current.name}
                                            </h3>
                                            <p className="text-cyan-600 dark:text-cyan-400 font-medium">
                                                {current.role}
                                            </p>
                                            <p className="text-slate-500 dark:text-slate-500 text-sm">
                                                {current.clinic}
                                            </p>
                                        </div>

                                        {/* Metric Badge */}
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
                                            <div className="p-2 bg-emerald-500/20 rounded-full text-emerald-600 dark:text-emerald-400">
                                                <TrendingUp className="w-5 h-5" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-wider font-bold">
                                                    Results
                                                </p>
                                                <p className="text-emerald-700 dark:text-emerald-400 font-bold">
                                                    {current.metric}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Navigation */}
                    <div className="flex items-center justify-center gap-4 mt-8">
                        <button
                            onClick={handlePrev}
                            className="p-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            aria-label="Previous testimonial"
                        >
                            <ChevronLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                        </button>

                        {/* Dots */}
                        <div className="flex gap-2">
                            {testimonials.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrentIndex(index)}
                                    className={`w-2 h-2 rounded-full transition-all ${index === currentIndex
                                        ? "bg-cyan-500 w-8"
                                        : "bg-slate-300 dark:bg-slate-600"
                                        }`}
                                    aria-label={`Go to testimonial ${index + 1}`}
                                />
                            ))}
                        </div>

                        <button
                            onClick={handleNext}
                            className="p-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            aria-label="Next testimonial"
                        >
                            <ChevronRight className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
