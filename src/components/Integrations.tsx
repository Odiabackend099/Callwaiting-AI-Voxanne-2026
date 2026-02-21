"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

// All integration logos — two rows for the marquee
const row1 = [
    { name: "Twilio", logo: "/integrations/twilio.png" },
    { name: "Vapi", logo: "/integrations/vapi.png" },
    { name: "ElevenLabs", logo: "/integrations/elevenlabs.png" },
    { name: "Vonage", logo: "/integrations/vonage.png" },
    { name: "Google Calendar", logo: "/integrations/google-calendar.png" },
    { name: "Outlook", logo: "/integrations/outlook.png" },
    { name: "Calendly", logo: "/integrations/calendly.png" },
    { name: "Cal.com", logo: "/integrations/cal-com.png" },
];

const row2 = [
    { name: "Salesforce", logo: "/integrations/salesforce.png" },
    { name: "Supabase", logo: "/integrations/supabase.png" },
    { name: "Monday", logo: "/integrations/monday.png" },
    { name: "Pipedrive", logo: "/integrations/pipedrive.png" },
    { name: "HubSpot", logo: "/integrations/hubspot.png" },
    { name: "Twilio", logo: "/integrations/twilio.png" },
    { name: "Vapi", logo: "/integrations/vapi.png" },
    { name: "Google Calendar", logo: "/integrations/google-calendar.png" },
];

function LogoCard({ tool }: { tool: { name: string; logo: string } }) {
    return (
        <motion.div
            whileHover={{ y: -4, boxShadow: "0 12px 30px rgba(29,78,216,0.10)" }}
            className="flex-shrink-0 flex flex-col items-center justify-center gap-2 w-[130px] h-[90px] rounded-2xl bg-white border border-surgical-100 shadow-sm px-4 py-4 cursor-default transition-all duration-300 group"
        >
            <div className="relative w-10 h-10 flex items-center justify-center">
                <Image
                    src={tool.logo}
                    alt={`${tool.name} logo`}
                    width={40}
                    height={40}
                    className="object-contain opacity-70 group-hover:opacity-100 transition-opacity duration-300"
                    onError={(e) => {
                        // Fallback: hide broken image
                        (e.target as HTMLImageElement).style.display = 'none';
                    }}
                />
            </div>
            <p className="text-[11px] font-medium text-obsidian/55 text-center leading-tight group-hover:text-obsidian/80 transition-colors duration-300">
                {tool.name}
            </p>
        </motion.div>
    );
}

function MarqueeRow({ logos, direction = "left" }: { logos: typeof row1; direction?: "left" | "right" }) {
    // Duplicate for infinite scroll
    const doubled = [...logos, ...logos];
    const animateX = direction === "left" ? ["0%", "-50%"] : ["-50%", "0%"];

    return (
        <div className="relative overflow-hidden w-full">
            {/* Fade edges */}
            <div className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none bg-gradient-to-r from-surgical-50 to-transparent" />
            <div className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none bg-gradient-to-l from-surgical-50 to-transparent" />

            <motion.div
                animate={{ x: animateX }}
                transition={{ duration: 30, ease: "linear", repeat: Infinity }}
                className="flex gap-4 w-max group-hover:[animation-play-state:paused]"
            >
                {doubled.map((tool, i) => (
                    <LogoCard key={`${tool.name}-${i}`} tool={tool} />
                ))}
            </motion.div>
        </div>
    );
}

export default function Integrations() {
    return (
        <section className="py-32 bg-surgical-50 relative overflow-hidden">
            {/* Dot grid */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle, #1D4ED8 1.5px, transparent 1.5px)', backgroundSize: '32px 32px' }} />

            <div className="section-container relative z-10">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center max-w-3xl mx-auto mb-16"
                >
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-surgical-200 rounded-full text-xs font-semibold text-surgical-700 mb-6 uppercase tracking-widest">
                        <Sparkles className="w-3 h-3" />
                        Integrations
                    </span>
                    <h2 className="font-sans font-bold text-4xl md:text-5xl text-obsidian tracking-tight mb-5">
                        Integrates with your{" "}
                        <span className="font-sans font-semibold text-surgical-600">existing stack</span>
                    </h2>
                    <p className="text-lg text-obsidian/50">
                        No rip-and-replace. Voxanne connects to the tools you already use.
                    </p>
                </motion.div>

                {/* Marquee rows */}
                <div className="flex flex-col gap-4 group">
                    <MarqueeRow logos={row1} direction="left" />
                    <MarqueeRow logos={row2} direction="right" />
                </div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 }}
                    className="text-center mt-12"
                >
                    <p className="text-sm text-obsidian/40 font-medium">
                        + 40 more integrations available via API & Zapier
                    </p>
                </motion.div>
            </div>
        </section>
    );
}
