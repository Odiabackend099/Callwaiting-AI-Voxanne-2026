"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, ShieldCheck, Stethoscope, Network, TrendingUp } from 'lucide-react';

interface FAQItem {
    question: string;
    answer: string;
}

interface FAQCategory {
    title: string;
    icon: React.ElementType;
    items: FAQItem[];
}

const faqData: FAQCategory[] = [
    {
        title: "Medical Compliance & Security",
        icon: ShieldCheck,
        items: [
            { question: "Is Voxanne AI compliant with data protection regulations?", answer: "Yes, Voxanne AI is built with enterprise-grade security and is fully UK GDPR and HIPAA compliant. We provide DPAs (Data Processing Agreements) for UK/EU customers and sign BAAs (Business Associate Agreements) with US healthcare practices." },
            { question: "Does she store patient data?", answer: "Voxanne AI only temporarily processes data needed for booking (name, reason for visit). All data is encrypted in transit and at rest, adhering to strict privacy standards." },
            { question: "Can she handle medical emergencies?", answer: "Voxanne AI is trained to recognize emergency keywords (e.g., 'bleeding', 'pain', 'breathing'). She immediately routes these calls to your emergency line or instructs the patient to hang up and dial 911/999." },
            { question: "What about liability if she makes a mistake?", answer: "Voxanne AI operates within your strict guardrails. If she is unsure, she executes a 'Human Escalation Protocol' to transfer the call or take a message. All calls are recorded for your review and liability protection." }
        ]
    },
    {
        title: "Medical Terminology & Scope",
        icon: Stethoscope,
        items: [
            { question: "Does Voxanne AI understand BBL, Mommy Makeover, etc.?", answer: "Yes. Voxanne AI is pre-trained on 500+ cosmetic and medical procedures, from BBLs and Rhinoplasties to CoolSculpting and Mohs surgery." },
            { question: "Can she quote pricing?", answer: "Only if you want her to. We can configure her to give specific ranges (e.g., '$8k-$12k for BBL') or to defer pricing to the in-person consultation." },
            { question: "What if a patient asks about recovery time?", answer: "Voxanne AI delivers your approved clinical answers. For example: 'Dr. Chen typically advises 2 weeks off work for a tummy tuck.'" },
            { question: "Can she handle insurance questions?", answer: "Voxanne AI can answer basic network questions ('Do you take Blue Cross?') and route complex billing inquiries directly to your billing coordinator." }
        ]
    },
    {
        title: "Practice Integration",
        icon: Network,
        items: [
            { question: "What EMRs do you integrate with?", answer: "We support direct integrations with major aesthetic EMRs including Mindbody, Nextech, Aesthetics Pro, and DrChrono. We can also connect via custom API." },
            { question: "How long is setup?", answer: "Because Call Waiting AI is pre-trained on medical workflows, we can go live in as little as 48 hours after your 15-minute onboarding call." },
            { question: "Do I need to train her?", answer: "No. Our team configures her voice, knowledge base, and booking rules for you. You just hand us your FAQ doc." },
            { question: "Can I customize her responses?", answer: "Absolutely. In our Growth and Premium tiers, you have full control over her script, tone, and objection handling." }
        ]
    },
    {
        title: "Business & ROI",
        icon: TrendingUp,
        items: [
            { question: "Does she replace my receptionist?", answer: "No. Call Waiting AI handles the 'busy work'—overflow calls, after-hours inquiries, and FAQ. This frees your front desk to focus on the high-value patients in front of them." },
            { question: "What if I want to cancel?", answer: "We operate on a month-to-month basis with a simple 30-day notice. We believe you'll stay because of the ROI, not a contract." },
            { question: "What's the ROI?", answer: "Our average plastic surgery client books 3-5 additional consultations per month specifically from after-hours calls. With a $10k avg case value, that's $30k-$50k in retained revenue." }
        ]
    }
];

export const MedicalFAQ = () => {
    const [openIndex, setOpenIndex] = useState<string | null>(null);

    const toggleAccordion = (index: string) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <section className="py-24 bg-surgical-50 relative overflow-hidden" id="faq">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-surgical-100/50 via-surgical-50 to-surgical-50" />

            <div className="container mx-auto px-4 relative z-10">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-obsidian to-surgical-600 mb-4">
                        Common Questions from Medical Directors
                    </h2>
                    <p className="text-obsidian/70 max-w-2xl mx-auto">
                        Clarifying compliance, capabilities, and clinical integration.
                    </p>
                </div>

                <div className="max-w-4xl mx-auto grid gap-8">
                    {faqData.map((category, catIndex) => (
                        <div key={catIndex} className="space-y-4">
                            <div className="flex items-center gap-2 mb-4">
                                <category.icon className="w-5 h-5 text-surgical-600" />
                                <h3 className="text-xl font-semibold text-obsidian">{category.title}</h3>
                            </div>

                            <div className="grid gap-3">
                                {category.items.map((item, itemIndex) => {
                                    const index = `${catIndex}-${itemIndex}`;
                                    const isOpen = openIndex === index;

                                    return (
                                        <motion.div
                                            key={index}
                                            className="group"
                                            initial={false}
                                        >
                                            <button
                                                onClick={() => toggleAccordion(index)}
                                                className={`w-full text-left p-4 md:p-6 rounded-2xl flex items-start justify-between gap-4 transition-all duration-300 ${isOpen
                                                    ? 'bg-white shadow-lg ring-1 ring-surgical-200'
                                                    : 'bg-white/60 hover:bg-white'
                                                    }`}
                                            >
                                                <span className={`font-medium text-lg transition-colors ${isOpen ? 'text-surgical-600' : 'text-obsidian group-hover:text-surgical-600'}`}>
                                                    {item.question}
                                                </span>
                                                <span className={`flex-shrink-0 mt-1 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                                                    {isOpen ? (
                                                        <Minus className="w-5 h-5 text-surgical-600" />
                                                    ) : (
                                                        <Plus className="w-5 h-5 text-obsidian/40 group-hover:text-surgical-600" />
                                                    )}
                                                </span>
                                            </button>

                                            <AnimatePresence>
                                                {isOpen && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="p-6 pt-2 text-obsidian/70 leading-relaxed border-l-2 border-surgical-200 ml-6">
                                                            {item.answer}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
