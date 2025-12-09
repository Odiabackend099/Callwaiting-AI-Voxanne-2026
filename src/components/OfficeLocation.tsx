"use client";

import { motion } from "framer-motion";
import { MapPin, Phone, Mail } from "lucide-react";

export default function OfficeLocation() {
    return (
        <section className="py-24 px-6 bg-[#050505] border-t border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-900/10 to-transparent pointer-events-none" />

            <div className="container mx-auto max-w-7xl relative z-10">
                <div className="grid md:grid-cols-2 gap-16 items-center">

                    {/* Contact Info */}
                    <div>
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            className="text-4xl font-bold text-white mb-8"
                        >
                            Visit Our HQ
                        </motion.h2>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="space-y-8"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-cyan-400 shrink-0">
                                    <MapPin className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">Global Headquarters</h3>
                                    <p className="text-zinc-400 text-sm leading-relaxed">
                                        Collage House, 2nd Floor<br />
                                        17 King Edward Road<br />
                                        Ruislip, London HA4 7AE<br />
                                        United Kingdom
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-zinc-900 border border-white/5 rounded-lg text-cyan-400">
                                    <Phone className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-white font-semibold mb-1">Phone</h4>
                                    <a href="tel:+447424038250" className="text-zinc-400 text-sm hover:text-cyan-400 transition-colors">
                                        +44 7424 038250
                                    </a>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-cyan-400 shrink-0">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">Email Us</h3>
                                    <a href="mailto:support@callwaitingai.dev" className="text-zinc-400 hover:text-cyan-400 transition-colors">
                                        support@callwaitingai.dev
                                    </a>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Google Maps Embed */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="relative h-[400px] rounded-2xl overflow-hidden border border-white/10 bg-zinc-900"
                    >
                        <iframe
                            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2478.8!2d-0.4234!3d51.5732!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x48766e0c8f8f8f8f%3A0x0!2s17%20King%20Edward%20Rd%2C%20Ruislip%20HA4%207AE%2C%20UK!5e0!3m2!1sen!2sus!4v1234567890"
                            width="100%"
                            height="100%"
                            style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg)' }}
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title="CallWaiting AI Office Location"
                            className="grayscale"
                        ></iframe>

                        {/* Overlay for dark theme styling */}
                        <div className="absolute inset-0 bg-black/20 pointer-events-none mix-blend-multiply"></div>

                        {/* Location Marker Overlay */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none">
                            <div className="relative">
                                <div className="w-4 h-4 bg-cyan-500 rounded-full animate-ping absolute inset-0 opacity-75"></div>
                                <div className="w-4 h-4 bg-cyan-500 rounded-full border-2 border-black relative z-10"></div>
                            </div>
                            <div className="px-3 py-1 bg-black/90 backdrop-blur-md rounded-lg border border-cyan-500/50 text-xs font-bold text-white shadow-lg">
                                CallWaiting AI HQ
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
