"use client";
import { Section } from "@/components/Section";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
    {
        question: "How is Voxanne related to Call Waiting AI?",
        answer: "Voxanne is a premium product line developed by Call Waiting AI, leveraging our core technology with enhanced features specifically for high-volume clinics."
    },
    {
        question: "What industries does Voxanne specialize in?",
        answer: "We focus heavily on healthcare, dental, legal services, and premium customer support sectors where trust and accuracy are paramount."
    },
    {
        question: "Can I migrate from Call Waiting AI to Voxanne?",
        answer: "Yes! Existing Call Waiting AI customers get priority migration paths. Contact your account manager to schedule a seamless transition."
    },
    {
        question: "Is Voxanne HIPAA compliant?",
        answer: "Absolutely. We employ bank-grade encryption and strict RLS (Row Level Security) to ensure patient data is isolated and protected at all times."
    }
];

export function FAQ() {
    return (
        <Section className="bg-slate-50">
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-navy-900">Frequently Asked Questions</h2>
                </div>

                <Accordion type="single" collapsible className="w-full space-y-4">
                    {faqs.map((faq, i) => (
                        <AccordionItem key={i} value={`item-${i}`} className="bg-white px-6 rounded-2xl border border-slate-100 shadow-sm data-[state=open]:border-surgical-200">
                            <AccordionTrigger className="text-navy-900 font-semibold hover:no-underline hover:text-surgical-600 text-left py-6">
                                {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-slate-600 pb-6 leading-relaxed">
                                {faq.answer}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </Section>
    );
}
