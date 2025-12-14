"use client";

import { motion } from "framer-motion";
import { Smartphone, MessageSquare, Bell, BarChart3 } from "lucide-react";

export default function MobileShowcase() {
    return (
        <section className="py-24 bg-black overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 to-purple-900/10" />

            <div className="container mx-auto px-6 relative z-10">
                <div className="flex flex-col lg:flex-row items-center gap-16">

                    {/* Text Side */}
                    <div className="flex-1 text-center lg:text-left">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <span className="inline-block py-1 px-3 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-widest mb-6">
                                iOS & Android Ready
                            </span>
                            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
                                Your Practice in Your <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                                    Pocket.
                                </span>
                            </h2>
                            <p className="text-zinc-400 text-lg mb-8 max-w-xl mx-auto lg:mx-0">
                                You shouldn't be tethered to a desk. Manage your entire intake pipeline, listen to call recordings, and triage patients from your smartphone.
                            </p>

                            <div className="grid gap-6">
                                {[
                                    { icon: MessageSquare, title: "SMS Follow-up", desc: "Instantly text patients who hung up." },
                                    { icon: Bell, title: "Real-time Alerts", desc: "Get notified for BBL or high-value consults." },
                                    { icon: BarChart3, title: "Live Analytics", desc: "Track daily revenue from your phone." }
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                                        <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                                            <item.icon className="w-6 h-6" />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="text-white font-bold">{item.title}</h3>
                                            <p className="text-zinc-500 text-sm">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>

                    {/* Mockup Side */}
                    <div className="flex-1 relative">
                        {/* Circle Glow */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px]" />

                        <motion.div
                            initial={{ opacity: 0, y: 40, rotate: -5 }}
                            whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="relative mx-auto w-[300px] h-[600px] bg-black border-[8px] border-zinc-800 rounded-[3rem] shadow-2xl overflow-hidden"
                        >
                            {/* Notch */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-20" />

                            {/* Screen Content - Mock Dashboard */}
                            <div className="w-full h-full bg-slate-950 p-6 pt-12 flex flex-col">
                                <div className="flex justify-between items-center mb-8">
                                    <div className="w-8 h-8 rounded-full bg-gray-800" />
                                    <div className="font-bold text-white">Dashboard</div>
                                    <Bell className="w-5 h-5 text-white" />
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-4 rounded-2xl text-white shadow-lg">
                                        <div className="text-xs opacity-80 mb-1">Total Revenue</div>
                                        <div className="text-3xl font-bold">$14,250</div>
                                        <div className="text-xs mt-2 flex items-center gap-1"><span className="bg-white/20 px-1 rounded text-[10px]">+12%</span> vs last week</div>
                                    </div>

                                    <div className="text-xs font-bold text-zinc-500 uppercase mt-4">Recent Bookings</div>

                                    {[
                                        { name: "Sarah J.", service: "BBL Consult", time: "2m ago", status: "Booked" },
                                        { name: "Mike R.", service: "Rhinoplasty", time: "15m ago", status: "Qualifying" },
                                        { name: "Jessica T.", service: "Botox", time: "1h ago", status: "Booked" },
                                    ].map((call, i) => (
                                        <div key={i} className="bg-white/5 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                                                    {call.name[0]}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-white">{call.name}</div>
                                                    <div className="text-xs text-zinc-500">{call.service}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-xs font-bold ${call.status === 'Booked' ? 'text-green-400' : 'text-amber-400'}`}>{call.status}</div>
                                                <div className="text-[10px] text-zinc-600">{call.time}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>

                        {/* Mobile App Mentions */}
                        <div className="mt-12 p-8 rounded-3xl bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border border-cyan-500/20">
                            <h3 className="text-2xl font-bold text-white mb-4 text-center">Manage from Anywhere</h3>
                            <p className="text-slate-300 text-center mb-6">
                                Control Voxanne from your phone with our iOS and Android apps. Monitor calls, update settings, and respond to leads on the go.
                            </p>
                            <div className="flex items-center justify-center gap-6 flex-wrap">
                                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/50 border border-white/10">
                                    <Smartphone className="w-5 h-5 text-cyan-400" />
                                    <span className="text-white font-medium">iOS App</span>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/50 border border-white/10">
                                    <Smartphone className="w-5 h-5 text-green-400" />
                                    <span className="text-white font-medium">Android App</span>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/50 border border-white/10">
                                    <MessageSquare className="w-5 h-5 text-green-400" />
                                    <span className="text-white font-medium">WhatsApp Integration</span>
                                </div>
                            </div>
                            <p className="text-slate-400 text-sm text-center mt-4">
                                Get instant notifications when Voxanne books a consultation or needs your attention
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
