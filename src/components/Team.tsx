"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function Team() {
    return (
        <section className="py-24 px-6 bg-[#050505] border-t border-white/5">
            <div className="container mx-auto max-w-6xl">
                <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
                    <div>
                        <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">Why We Built Voxanne</h2>
                        <p className="text-zinc-400 text-lg leading-relaxed mb-6">
                            CallWaiting AI was founded on a simple premise: <span className="text-white">Healthcare providers should be focused on patients, not phones.</span>
                        </p>
                        <p className="text-zinc-400 text-lg leading-relaxed">
                            We saw brilliant surgeons losing millions in revenue simply because they were too busy saving lives to answer the phone. We built Voxanne to bridge that gap—ensuring no patient is ever ignored, and no practice ever "bleeds" revenue again.
                        </p>
                    </div>
                    <div className="bg-zinc-900/30 p-8 rounded-3xl border border-white/5">
                        <h3 className="text-xl font-bold text-white mb-4">Our Mission</h3>
                        <p className="text-zinc-400 italic mb-6">"To empower every medical practice to capture 100% of their demand, automatically."</p>
                        <div className="flex gap-4">
                            <div className="flex-1 p-4 bg-black/50 rounded-xl text-center">
                                <div className="text-3xl font-bold text-cyan-400 mb-1">24/7</div>
                                <div className="text-xs text-zinc-500 uppercase tracking-wider">Availability</div>
                            </div>
                            <div className="flex-1 p-4 bg-black/50 rounded-xl text-center">
                                <div className="text-3xl font-bold text-purple-400 mb-1">100%</div>
                                <div className="text-xs text-zinc-500 uppercase tracking-wider">Compliance</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="text-center mb-16">
                    <h2 className="text-2xl font-bold mb-4 text-white">Leadership Team</h2>
                    <p className="text-zinc-400">Built by entrepreneurs, for entrepreneurs.</p>
                </div>
                <div className="grid md:grid-cols-3 gap-8">
                    {[
                        {
                            name: "Peter Ntaji",
                            role: "CEO & Founder",
                            bio: "Voxanne isn't here to replace your staff. She's here to empower them—handling the overflow so they can focus on care.",
                            image: "/images/team/peter-ntaji.png"
                        },
                        {
                            name: "Austyn Eguale",
                            role: "Co-Founder & CTO",
                            bio: "We're not just building AI that talks. We're building AI that understands context and intent.",
                            image: "/images/team/austyn-eguale.png"
                        },
                        {
                            name: "Benjamin Nwoye",
                            role: "Head of Human & International Relations",
                            bio: "Our success is measured by the success stories of the businesses we serve globally."
                        }
                    ].map((member, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="p-8 rounded-2xl bg-zinc-900/40 border border-white/5 text-center group relative overflow-hidden hover:bg-zinc-900/60 transition-colors"
                        >
                            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-cyan-900/30 to-blue-900/30 rounded-full mb-6 flex items-center justify-center text-cyan-400 font-bold text-3xl group-hover:scale-110 transition-transform shadow-lg border border-cyan-500/20 relative overflow-hidden">
                                {member.image ? (
                                    <Image
                                        src={member.image}
                                        alt={member.name}
                                        fill
                                        sizes="96px"
                                        className="object-cover"
                                    />
                                ) : (
                                    member.name.split(' ').map(n => n[0]).join('')
                                )}
                            </div>
                            <h3 className="text-xl font-bold text-white mb-1">{member.name}</h3>
                            <p className="text-cyan-500 font-medium mb-4 text-sm uppercase tracking-wide">{member.role}</p>
                            <p className="text-zinc-400 text-sm leading-relaxed italic relative z-10">"{member.bio}"</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
