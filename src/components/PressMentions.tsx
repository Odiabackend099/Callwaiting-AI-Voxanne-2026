"use client";

import { motion } from "framer-motion";

const pressLogos = [
    { name: "TechCrunch", width: 140 },
    { name: "Forbes", width: 100 },
    { name: "Healthcare IT News", width: 160 },
    { name: "VentureBeat", width: 130 },
];

export default function PressMentions() {
    return (
        <section className="py-16 bg-slate-950 border-y border-white/5">
            <div className="container mx-auto px-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <p className="text-slate-500 text-sm uppercase tracking-wider mb-6">
                        As Featured In
                    </p>
                </motion.div>

                <div className="flex flex-wrap items-center justify-center gap-12 opacity-40 grayscale hover:opacity-60 transition-opacity">
                    {pressLogos.map((logo, index) => (
                        <motion.div
                            key={logo.name}
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className="text-slate-400 font-bold text-xl"
                            style={{ width: logo.width }}
                        >
                            {logo.name}
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
