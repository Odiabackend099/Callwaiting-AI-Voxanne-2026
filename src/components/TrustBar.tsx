"use client";

import FadeIn from "@/components/ui/FadeIn";
import Image from "next/image";

const partners = [
    { name: "Vapi", logo: "/integrations/vapi.png" },
    { name: "Twilio", logo: "/integrations/twilio.png" },
    { name: "Google Calendar", logo: "/integrations/google-calendar.png" },
    { name: "Supabase", logo: "/integrations/supabase.png" },
];

export default function TrustBar() {
    return (
        <section className="bg-slate-50 py-12 border-y border-slate-100">
            <div className="max-w-7xl mx-auto px-6">
                <FadeIn>
                    <p className="text-center text-sm font-semibold text-slate-500 uppercase tracking-wider mb-8">
                        Built for clinics and med spas
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-items-center">
                        {partners.map((partner) => (
                            <div key={partner.name} className="relative w-32 h-12 flex items-center justify-center transition-all duration-300 cursor-pointer hover:scale-105">
                                <Image
                                    src={partner.logo}
                                    alt={`${partner.name} logo`}
                                    fill
                                    sizes="128px"
                                    className="object-contain"
                                />
                            </div>
                        ))}
                    </div>
                </FadeIn>
            </div>
        </section>
    );
}
