'use client';
import { motion } from 'framer-motion';
import {
    Bot, Clock, Shield, BarChart3, Zap, Mic
} from 'lucide-react';

const features = [
    {
        icon: Bot,
        title: 'AI Receptionist 24/7',
        description: 'Never miss a call, even at 2 AM. Your AI receptionist works around the clock.',
        gradient: 'from-blue-500 to-blue-600',
        stat: '100% Uptime',
        colSpan: 'md:col-span-2', // Large featured card
    },
    {
        icon: Clock,
        title: 'Instant Responses',
        description: 'Patients get answers in under 1 second. No hold music, no waiting.',
        gradient: 'from-purple-500 to-purple-600',
        stat: '<1s Response',
    },
    {
        icon: Shield,
        title: 'HIPAA Compliant',
        description: 'Enterprise-grade security with full HIPAA compliance out of the box.',
        gradient: 'from-emerald-500 to-emerald-600',
    },
    {
        icon: BarChart3,
        title: 'Real-Time Analytics',
        description: 'Track every call, booking, and revenue opportunity from your dashboard.',
        gradient: 'from-pink-500 to-pink-600',
    },
    {
        icon: Zap,
        title: '15-Minute Setup',
        description: 'Upload your knowledge base, connect your calendar, and go live.',
        gradient: 'from-amber-500 to-amber-600',
    },
    {
        icon: Mic,
        title: 'Human-Like Voice',
        description: 'Natural conversations that patients trust. 98% satisfaction rate.',
        gradient: 'from-cyan-500 to-cyan-600',
        stat: '98% Satisfaction',
    },
];

export function FeaturesBentoGrid() {
    return (
        <section className="py-24">
            <div className="container mx-auto px-4">
                <h2 className="mb-4 text-center text-4xl font-bold text-gray-900 md:text-5xl">
                    Everything Your Front Desk Does.<br />Just Faster.
                </h2>
                <p className="mb-16 text-center text-lg text-gray-600">
                    Powered by AI that sounds human and works 24/7
                </p>

                <div className="grid gap-6 md:grid-cols-4">
                    {features.map((feature, index) => {
                        const Icon = feature.icon;
                        return (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                                className={`group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-xl ${feature.colSpan || ''}`}
                            >
                                {/* Icon */}
                                <div className={`mb-4 inline-flex rounded-2xl bg-gradient-to-br ${feature.gradient} p-4`}>
                                    <Icon className="h-8 w-8 text-white" />
                                </div>

                                {/* Stat Badge (if exists) */}
                                {feature.stat && (
                                    <div className="mb-4 inline-block rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                                        {feature.stat}
                                    </div>
                                )}

                                <h3 className="mb-2 text-xl font-bold text-gray-900">
                                    {feature.title}
                                </h3>
                                <p className="text-gray-600">
                                    {feature.description}
                                </p>

                                {/* Gradient overlay on hover */}
                                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 transition-opacity group-hover:opacity-5`} />
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
