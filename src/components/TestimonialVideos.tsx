"use client";

import { motion } from "framer-motion";
import { Play, Quote } from "lucide-react";
import { useState } from "react";

const testimonials = [
    {
        name: "Dr. Sarah Chen",
        role: "Plastic Surgeon",
        clinic: "Beverly Hills Aesthetic Center",
        quote: "CALL WAITING AI LTD paid for herself in the first month. We're now capturing every single after-hours BBL inquiry that we used to miss.",
        videoUrl: "/testimonials/dr-chen.mp4",
        thumbnail: "/testimonials/dr-chen-thumb.jpg",
        results: "+42% bookings"
    },
    {
        name: "Dr. James Morrison",
        role: "Dermatologist",
        clinic: "Harley Street Dermatology",
        quote: "The British accent was crucial for our clientele. CALL WAITING AI LTD sounds more professional than our previous receptionist.",
        videoUrl: "/testimonials/dr-morrison.mp4",
        thumbnail: "/testimonials/dr-morrison-thumb.jpg",
        results: "£95K added revenue"
    },
    {
        name: "Maria Rodriguez",
        role: "Med Spa Owner",
        clinic: "Ocean Drive Med Spa",
        quote: "We went from missing 30% of calls to missing zero. The ROI is insane - we're booking 55% more consultations.",
        videoUrl: "/testimonials/maria.mp4",
        thumbnail: "/testimonials/maria-thumb.jpg",
        results: "+55% consultations"
    }
];

export default function TestimonialVideos() {
    const [activeVideo, setActiveVideo] = useState<number | null>(null);

    return (
        <section className="py-24 bg-gradient-to-b from-black to-slate-950">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="text-3xl md:text-5xl font-bold text-white mb-6"
                    >
                        Hear From Our Clients
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-slate-400 max-w-2xl mx-auto text-lg"
                    >
                        Real doctors, real results. Watch how CALL WAITING AI LTD transformed their practices.
                    </motion.p>
                </div>

                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {testimonials.map((testimonial, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="group"
                        >
                            {/* Video Thumbnail */}
                            <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-white/10 mb-6 cursor-pointer group-hover:border-cyan-500/30 transition-all">
                                {/* Placeholder for video */}
                                <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 to-blue-900/20 flex items-center justify-center">
                                    <button
                                        onClick={() => setActiveVideo(index)}
                                        className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform"
                                    >
                                        <Play className="w-6 h-6 text-white ml-1" fill="white" />
                                    </button>
                                </div>

                                {/* Results Badge */}
                                <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-green-500/90 backdrop-blur-sm text-white text-sm font-bold">
                                    {testimonial.results}
                                </div>
                            </div>

                            {/* Quote */}
                            <div className="relative pl-6 border-l-2 border-cyan-500/20 mb-4">
                                <Quote className="absolute -left-2 -top-2 w-8 h-8 text-cyan-500/20" />
                                <p className="text-slate-300 italic text-sm leading-relaxed">
                                    "{testimonial.quote}"
                                </p>
                            </div>

                            {/* Author */}
                            <div>
                                <h4 className="text-white font-bold">{testimonial.name}</h4>
                                <p className="text-cyan-400 text-sm">{testimonial.role}</p>
                                <p className="text-slate-500 text-xs">{testimonial.clinic}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Video Modal Placeholder */}
                {activeVideo !== null && (
                    <div
                        className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                        onClick={() => setActiveVideo(null)}
                    >
                        <div className="max-w-4xl w-full aspect-video bg-slate-900 rounded-2xl flex items-center justify-center">
                            <p className="text-white">Video Player Placeholder</p>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
