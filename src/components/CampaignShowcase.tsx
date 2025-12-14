"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Image from "next/image";

const CAMPAIGNS = [
    { id: 1, src: "/campaigns/resource_9ltCVdMUYmv9yVAyBQIkEL.png", title: "Stop the Revenue Leak" },
    { id: 2, src: "/campaigns/resource_bq982z4VJm6bDMH2oYdk1N.png", title: "Never Miss a Consultation" },
    { id: 3, src: "/campaigns/resource_baoMoNSrueT23LGWB1c_fA.png", title: "Unanswered Calls = Lost Patients" },
    { id: 4, src: "/campaigns/resource_9Jl0RXn61UJdSrgTMuDOHn.png", title: "Stop the Drain. Start the Flow." },
];

export default function CampaignShowcase() {
    const targetRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: targetRef,
        offset: ["start start", "end end"],
    });

    // Calculate proper scroll distance: start from left edge, scroll to show all images
    // 4 images × 600px + 3 gaps × 32px = 2496px total width
    // We want to scroll from showing first image to showing last image fully
    const x = useTransform(scrollYProgress, [0, 1], ["5%", "-75%"]);

    return (
        <section ref={targetRef} className="relative h-[300vh] bg-zinc-950">
            <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden">
                <div className="container mx-auto px-6 mb-12">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-3xl md:text-5xl font-bold text-white text-center"
                    >
                        Designed for <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">High-End Clinics</span>
                    </motion.h2>
                    <p className="text-center text-zinc-500 mt-4 max-w-2xl mx-auto">
                        Your brand is premium. Your receptionist should be too. Voxanne delivers a white-glove experience that matches your aesthetic.
                    </p>
                </div>

                <motion.div style={{ x }} className="flex gap-8 pl-12 pr-[50vw] will-change-transform">
                    {CAMPAIGNS.map((camp) => (
                        <div
                            key={camp.id}
                            className="relative shrink-0 w-[400px] h-[500px] md:w-[600px] md:h-[700px] rounded-2xl overflow-hidden border border-white/10 group"
                        >
                            <Image
                                src={camp.src}
                                alt={camp.title}
                                fill
                                className="object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-8">
                                <p className="text-white text-xl font-medium">{camp.title}</p>
                            </div>
                        </div>
                    ))}
                </motion.div>

                <div className="absolute bottom-10 left-0 right-0 text-center text-zinc-600 text-sm">
                    Social Media Ready Assets included
                </div>
            </div>
        </section>
    );
}
