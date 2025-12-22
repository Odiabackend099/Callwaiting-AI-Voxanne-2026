"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SmoothScroll from "@/components/SmoothScroll";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import TrustedBy from "@/components/TrustedBy";
import RevenueLeak from "@/components/RevenueLeak";
import SafetySection from "@/components/SafetySection";
import HowItWorks from "@/components/HowItWorks";
import TestimonialCarousel from "@/components/TestimonialCarousel";
import Pricing from "@/components/Pricing";
import RiskReversal from "@/components/RiskReversal";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import { ChatWidget } from "@/components/ChatWidget";
import LiveChatWidget from "@/components/LiveChatWidget";
import PressMentions from "@/components/PressMentions";
import CompetitorComparison from "@/components/CompetitorComparison";
import { MedicalFAQ } from "@/components/MedicalFAQ";
import Team from "@/components/Team";
import OfficeLocation from "@/components/OfficeLocation";

function AuthCodeRedirector() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const code = searchParams.get('code');
        if (code) {
            const qs = searchParams.toString();
            router.replace(qs ? `/auth/callback?${qs}` : '/auth/callback');
        }
    }, [router, searchParams]);

    return null;
}

export default function Home() {
    const openBooking = () => {
        if (typeof window !== 'undefined') {
            window.location.href = 'https://calendly.com/austyn-callwaitingai/30min';
        }
    };

    return (
        <SmoothScroll>
            <main className="relative min-h-screen bg-black text-white selection:bg-purple-500/30">
                <Suspense fallback={null}>
                    <AuthCodeRedirector />
                </Suspense>
                <Navbar />

                {/* 1. HOOK: Reptilian Brain & Loss Aversion */}
                <Hero onBookDemo={openBooking} />

                {/* Authority Anchors */}
                <TrustedBy />
                <PressMentions />

                {/* 2. PAIN: Make the problem hurt */}
                <RevenueLeak />

                {/* 3. SOLUTION & SAFETY: The unique mechanism */}
                <SafetySection />

                {/* 4. PROCESS: How It Works */}
                <HowItWorks />

                {/* 5. SOCIAL PROOF: Reinforce the decision */}
                <TestimonialCarousel />
                <CompetitorComparison />

                {/* 6. OFFER: The Pricing & Guarantee */}
                <Pricing onBookDemo={openBooking} />
                <RiskReversal />

                {/* 7. CLOSING CTA */}
                <CTA onBookDemo={openBooking} />

                {/* Supporting Content (SEO & Trust) */}
                <MedicalFAQ />
                <Team />
                <OfficeLocation />

                <Footer />
                <ChatWidget />
                <LiveChatWidget />
            </main>
        </SmoothScroll>
    );
}
