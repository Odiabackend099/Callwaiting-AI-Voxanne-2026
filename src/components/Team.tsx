"use client";
import { Section } from "@/components/Section";
import { motion } from "framer-motion";
import { Linkedin } from "lucide-react";

const team = [
    {
        name: "Peter Ntaji",
        role: "CEO & Founder",
        bio: "Visionary leader driving innovation in healthcare AI automation",
        linkedin: "#",
        image: "/team/peter-ntaji.jpg" // Placeholder
    },
    {
        name: "Austyn Eguale",
        role: "Co-Founder & CTO",
        bio: "Technical architect building enterprise-grade voice AI infrastructure",
        linkedin: "#",
        image: "/team/austyn-eguale.jpg" // Placeholder
    },
    {
        name: "Benjamin Nwoye",
        role: "Head of Human & International Relations",
        bio: "Expanding Voxanne's global footprint across healthcare markets",
        linkedin: "#",
        image: "/team/benjamin-nwoye.jpg" // Placeholder
    }
];

const easeOutExpo: [number, number, number, number] = [0.19, 1, 0.22, 1];

const container = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15
        }
    }
};

const item = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.8, ease: easeOutExpo }
    }
};

export function Team() {
    return (
        <Section className="bg-slate-50/50">
            <div className="text-center mb-16">
                <motion.h2
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: easeOutExpo }}
                    className="text-3xl md:text-4xl font-bold text-navy-900 mb-4"
                >
                    Meet the Team
                </motion.h2>
                <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.1, ease: easeOutExpo }}
                    className="text-lg text-slate-600"
                >
                    The minds behind Voxanne AI's intelligent voice automation
                </motion.p>
            </div>

            <motion.div
                variants={container}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto"
            >
                {team.map((member) => (
                    <motion.div
                        key={member.name}
                        variants={item}
                        whileHover={{ y: -8 }}
                        transition={{ duration: 0.3 }}
                        className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 hover:shadow-xl hover:border-surgical-200 transition-all group"
                    >
                        <div className="aspect-square rounded-xl bg-gradient-to-br from-surgical-50 to-slate-100 mb-6 flex items-center justify-center text-4xl font-bold text-surgical-600 overflow-hidden">
                            {/* Placeholder - replace with actual image */}
                            {member.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <h3 className="text-xl font-bold text-navy-900 mb-1">{member.name}</h3>
                        <p className="text-surgical-600 font-semibold text-sm mb-3">{member.role}</p>
                        <p className="text-slate-600 text-sm leading-relaxed mb-4">{member.bio}</p>
                        <a
                            href={member.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-surgical-600 hover:text-surgical-700 font-medium text-sm transition-colors"
                        >
                            <Linkedin className="w-4 h-4" />
                            Connect on LinkedIn
                        </a>
                    </motion.div>
                ))}
            </motion.div>
        </Section>
    );
}
