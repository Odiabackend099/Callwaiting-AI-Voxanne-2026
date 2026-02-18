'use client';
import { motion } from 'framer-motion';
import {
    Bot, Clock, Shield, BarChart3, Zap, Mic,
    Activity, Lock, CheckCircle2
} from 'lucide-react';

// Custom Icon Components

const AIReceptionistIcon = () => (
    <div className="relative w-16 h-16 flex items-center justify-center">
        {/* Background glow */}
        <div className="absolute inset-0 bg-blue-100 rounded-full opacity-50 blur-sm animate-pulse" />
        {/* Main Mic */}
        <div className="relative z-10 w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110 duration-300">
            <Bot className="text-white w-6 h-6" />
        </div>
        {/* Waveform accent */}
        <div className="absolute -right-2 top-0 bg-white p-1 rounded-full shadow-sm border border-blue-50">
            <Activity className="w-4 h-4 text-blue-500" />
        </div>
    </div>
);

const InstantResponseIcon = () => (
    <div className="relative w-16 h-16 flex items-center justify-center">
        {/* Background glow */}
        <div className="absolute inset-0 bg-purple-100 rounded-full opacity-50 blur-sm" />
        {/* Stopwatch */}
        <div className="relative z-10 w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110 duration-300">
            <Clock className="text-white w-6 h-6" />
        </div>
        {/* Checkmark accent */}
        <div className="absolute -right-2 -bottom-1 bg-green-100 p-1 rounded-full shadow-sm border border-white">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
        </div>
    </div>
);

const ComplianceIcon = () => (
    <div className="relative w-16 h-16 flex items-center justify-center">
        {/* Background glow */}
        <div className="absolute inset-0 bg-emerald-100 rounded-full opacity-50 blur-sm" />
        {/* Shield */}
        <div className="relative z-10 w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110 duration-300">
            <Shield className="text-white w-6 h-6" />
        </div>
        {/* Lock accent */}
        <div className="absolute -right-2 -top-1 bg-white p-1 rounded-full shadow-sm border border-emerald-50">
            <Lock className="w-3 h-3 text-emerald-600" />
        </div>
    </div>
);

const features = [
    {
        iconComponent: AIReceptionistIcon,
        title: 'AI Receptionist 24/7',
        description: 'Never miss a call, even at 2 AM. Your AI receptionist works around the clock.',
        gradient: 'from-blue-500 to-blue-600',
        stat: '100% Uptime',
        colSpan: 'md:col-span-2', // Large featured card
    },
    {
        iconComponent: InstantResponseIcon,
        title: 'Instant Responses',
        description: 'Patients get answers in under 1 second. No hold music, no waiting.',
        gradient: 'from-purple-500 to-purple-600',
        stat: '<1s Response',
        colSpan: '', // Standard size
    },
    {
        iconComponent: ComplianceIcon,
        title: 'UK GDPR & HIPAA Compliant',
        description: 'Enterprise-grade security with full UK GDPR and HIPAA compliance built-in.',
        gradient: 'from-emerald-500 to-emerald-600',
        colSpan: '',
    },
    {
        icon: BarChart3,
        title: 'Real-Time Analytics',
        description: 'Track every call, booking, and revenue opportunity from your dashboard.',
        gradient: 'from-pink-500 to-pink-600',
        colSpan: '',
    },
    {
        icon: Zap,
        title: '15-Minute Setup',
        description: 'Upload your knowledge base, connect your calendar, and go live.',
        gradient: 'from-amber-500 to-amber-600',
        colSpan: '',
    },
    {
        icon: Mic,
        title: 'Human-Like Voice',
        description: 'Natural conversations that patients trust. 98% satisfaction rate.',
        gradient: 'from-cyan-500 to-cyan-600',
        stat: '98% Satisfaction',
        colSpan: 'md:col-span-2',
    },
];

export function FeaturesBentoGrid() {
    return (
        <section id="features" className="py-32 bg-white">
            <div className="section-container">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-20"
                >
                    <h2 className="mb-5 font-sans font-bold text-4xl md:text-5xl lg:text-6xl text-obsidian tracking-tight">
                        Everything Your Front Desk Does.<br />
                        <span className="font-sans font-semibold text-surgical-600">Just Faster.</span>
                    </h2>
                    <p className="text-lg text-obsidian/50 max-w-2xl mx-auto">
                        Powered by AI that sounds human, works 24/7, and integrates with your existing tools.
                    </p>
                </motion.div>

                <div className="grid gap-6 md:grid-cols-4">
                    {features.map((feature, index) => {
                        return (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.08 }}
                                className={`group relative overflow-hidden rounded-2xl border border-surgical-200 bg-white p-8 transition-all duration-500 hover:shadow-lg hover:border-surgical-300 ${feature.colSpan || ''}`}
                            >
                                <div className="mb-6">
                                    {feature.iconComponent ? (
                                        <feature.iconComponent />
                                    ) : (
                                        <div className={`inline-flex rounded-xl bg-gradient-to-br ${feature.gradient} p-4 shadow-md group-hover:scale-105 transition-transform duration-500`}>
                                            {feature.icon && <feature.icon className="h-8 w-8 text-white" />}
                                        </div>
                                    )}
                                </div>

                                {feature.stat && (
                                    <div className="mb-4 inline-block rounded-full bg-surgical-50 border border-surgical-100 px-3 py-1 text-xs font-medium text-surgical-700 uppercase tracking-widest">
                                        {feature.stat}
                                    </div>
                                )}

                                <h3 className="mb-3 text-xl font-semibold text-obsidian">
                                    {feature.title}
                                </h3>
                                <p className="text-obsidian/60 leading-relaxed text-sm">
                                    {feature.description}
                                </p>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
