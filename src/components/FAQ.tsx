"use client";

import FadeIn from "@/components/ui/FadeIn";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
    {
        question: "What is Voxanne AI?",
        answer: "Voxanne AI is a voice-as-a-service platform that acts as an autonomous receptionist for your clinic. It answers calls, books appointments, and handles patient inquiries 24/7 using natural-sounding AI.",
    },
    {
        question: "How is Voxanne different from traditional IVR systems?",
        answer: "Unlike robotic 'press 1 for appointments' systems, Voxanne understands natural language. Patients can speak normally, ask complex questions, and have a real conversation, just like they would with a human receptionist.",
    },
    {
        question: "Is Voxanne compliant with data protection regulations?",
        answer: "Yes, Voxanne is fully UK GDPR and HIPAA compliant. All patient data is encrypted at rest and in transit. We provide Data Processing Agreements (DPA) for UK/EU customers and sign Business Associate Agreements (BAA) with US healthcare clients.",
    },
    {
        question: "Can Voxanne integrate with my existing calendar system?",
        answer: "Absolutely. Voxanne integrates seamlessly with Google Calendar, Outlook, Calendly, and major EHR systems to check availability and book appointments in real-time.",
    },
    {
        question: "What industries does Voxanne serve?",
        answer: "While we specialize in healthcare (clinics, med spas, dental practices), Voxanne can be customized for any appointment-based business.",
    },
    {
        question: "How much does Voxanne AI cost?",
        answer: "Top up your wallet from $25 and get credits. Credits are deducted based on call duration. No monthly subscriptions, no setup fees, and no lock-in. Every customer gets access to every feature.",
    },
    {
        question: "How does billing work?",
        answer: "Add credit to your wallet via card payment. When your AI agent handles calls, credits are deducted automatically based on call duration. You can enable auto-recharge so your wallet tops up automatically when the balance gets low. View all transactions in your dashboard.",
    },
    {
        question: "How long does setup take?",
        answer: "Most clinics are up and running in less than 15 minutes. Simply connect your calendar, customize your greeting, and forward your calls.",
    },
];

export default function FAQ() {
    return (
        <section id="faq" className="py-24 bg-white">
            <div className="max-w-3xl mx-auto px-6">
                <FadeIn>
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-obsidian tracking-tight mb-4">
                            Frequently Asked Questions
                        </h2>
                        <p className="text-lg text-obsidian/70">
                            Everything you need to know about Voxanne AI.
                        </p>
                    </div>
                </FadeIn>

                <FadeIn delay={0.2}>
                    <Accordion type="single" collapsible className="w-full">
                        {faqs.map((faq, index) => (
                            <AccordionItem key={index} value={`item-${index}`}>
                                <AccordionTrigger className="text-left text-lg font-medium text-obsidian hover:text-surgical-600">
                                    {faq.question}
                                </AccordionTrigger>
                                <AccordionContent className="text-obsidian/70 leading-relaxed">
                                    {faq.answer}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </FadeIn>
            </div>
        </section>
    );
}
