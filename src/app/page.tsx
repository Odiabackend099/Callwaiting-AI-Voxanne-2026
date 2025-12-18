"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SmoothScroll from "@/components/SmoothScroll";
import NavbarRedesigned from "@/components/NavbarRedesigned";
import HeroRedesigned from "@/components/HeroRedesigned";
import FeaturesRedesigned from "@/components/FeaturesRedesigned";
import HowItWorksRedesigned from "@/components/HowItWorksRedesigned";
import TestimonialsRedesigned from "@/components/TestimonialsRedesigned";
import PricingRedesigned from "@/components/PricingRedesigned";
import CTARedesigned from "@/components/CTARedesigned";
import FooterRedesigned from "@/components/FooterRedesigned";
import { BookingModal } from "@/components/BookingModal";
import { ChatWidget } from "@/components/ChatWidget";
import LiveChatWidget from "@/components/LiveChatWidget";
import TrustedBy from "@/components/TrustedBy";
import PressMentions from "@/components/PressMentions";
import SecurityBadges from "@/components/SecurityBadges";
import { MedicalFAQ } from "@/components/MedicalFAQ";

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
    const [isBookingOpen, setIsBookingOpen] = useState(false);

    const openBooking = () => setIsBookingOpen(true);

    return (
        <SmoothScroll>
            <main className="relative min-h-screen bg-cream text-charcoal selection:bg-cyan/30">
                <Suspense fallback={null}>
                    <AuthCodeRedirector />
                </Suspense>
                
                {/* Redesigned Navigation */}
                <NavbarRedesigned onBookDemo={openBooking} />

                {/* 1. HOOK: Hero with Parallax */}
                <HeroRedesigned onBookDemo={openBooking} />

                {/* Authority Anchors */}
                <TrustedBy />
                <PressMentions />

                {/* 2. FEATURES: What we offer */}
                <FeaturesRedesigned />

                {/* 3. PROCESS: How it works */}
                <HowItWorksRedesigned />

                {/* 4. SOCIAL PROOF: Testimonials */}
                <TestimonialsRedesigned />

                {/* 5. SECURITY & COMPLIANCE */}
                <SecurityBadges />

                {/* 6. PRICING */}
                <PricingRedesigned onBookDemo={openBooking} />

                {/* 7. FAQ */}
                <MedicalFAQ />

                {/* 8. FINAL CTA */}
                <CTARedesigned onBookDemo={openBooking} />

                {/* Redesigned Footer */}
                <FooterRedesigned />

                {/* Widgets */}
                <ChatWidget />
                <LiveChatWidget />
                <BookingModal isOpen={isBookingOpen} onClose={() => setIsBookingOpen(false)} />
            </main>
        </SmoothScroll>
    );
}
