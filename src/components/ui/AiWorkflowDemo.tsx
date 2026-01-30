'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Phone, MessageSquare, Calendar, Database, User, ArrowRight, CheckCircle2 } from 'lucide-react';

export const AiWorkflowDemo: React.FC = () => {
    const steps = [
        { icon: Phone, label: "Voice Call", color: "bg-blue-500" },
        { icon: MessageSquare, label: "SMS Sent", color: "bg-emerald-500" },
        { icon: Calendar, label: "Booking", color: "bg-purple-500" },
        { icon: Database, label: "CRM Sync", color: "bg-orange-500" },
    ];

    return (
        <div className="w-full max-w-4xl mx-auto p-8 bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative">
                {/* Connecting Line */}
                <div className="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-10" />

                {steps.map((step, index) => (
                    <div key={index} className="relative flex flex-col items-center gap-4 z-10 w-full md:w-auto">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: index * 0.5, duration: 0.5 }}
                            className={`w-16 h-16 rounded-2xl ${step.color} flex items-center justify-center shadow-lg text-white relative group cursor-pointer hover:scale-110 transition-transform`}
                        >
                            <step.icon className="w-8 h-8" />

                            {/* Success Badge */}
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: index * 0.5 + 0.3, type: "spring" }}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm"
                            >
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            </motion.div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.5 + 0.2 }}
                            className="text-center"
                        >
                            <p className="font-bold text-slate-900 text-sm">{step.label}</p>
                            <p className="text-xs text-slate-500">Automated</p>
                        </motion.div>

                        {/* Mobile Arrow */}
                        {index < steps.length - 1 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: index * 0.5 + 0.4 }}
                                className="md:hidden"
                            >
                                <ArrowRight className="w-6 h-6 text-slate-300" />
                            </motion.div>
                        )}
                    </div>
                ))}
            </div>

            {/* Live Action Simulation */}
            <div className="mt-12 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-navy-900 flex items-center justify-center text-white flex-shrink-0">
                        <User className="w-5 h-5" />
                    </div>
                    <div className="space-y-3 flex-1">
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 2.5 }}
                            className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 inline-block"
                        >
                            <p className="text-sm text-slate-700">"I need to schedule a dental cleaning for next Tuesday."</p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 3.5 }}
                            className="flex justify-end"
                        >
                            <div className="bg-surgical-600 text-white p-3 rounded-2xl rounded-tr-none shadow-md inline-block">
                                <p className="text-sm">"I can help with that. Checking availability for Tuesday... I have a 10 AM slot open. Shall I book it?"</p>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            transition={{ delay: 4.5 }}
                            className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center gap-3"
                        >
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            <div>
                                <p className="text-sm font-bold text-emerald-900">Appointment Confirmed</p>
                                <p className="text-xs text-emerald-700">SMS sent • Calendar updated • CRM synced</p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
};
