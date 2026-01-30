'use client';
import { motion } from 'framer-motion';
import Image from 'next/image';

const partners = [
    { name: 'Google Calendar', logo: '/integrations/google-calendar.png' },
    { name: 'Twilio', logo: '/integrations/twilio.png' },
    { name: 'Salesforce', logo: '/integrations/salesforce.png' },
    { name: 'Calendly', logo: '/integrations/calendly.png' },
    { name: 'Supabase', logo: '/integrations/supabase.png' },
    { name: 'Vapi', logo: '/integrations/vapi.png' },
];

export function TrustBarSimple() {
    // ✅ UPDATED: Duplicate partners array for seamless infinite scroll
    const allPartners = [...partners, ...partners];

    return (
        <section className="bg-sterile-wash py-16 overflow-hidden">
            <div className="container mx-auto">
                <div className="mb-12 text-center">
                    <h2 className="text-2xl font-bold text-clinical-blue mb-2">
                        Trusted Integrations
                    </h2>
                    <p className="text-sm text-deep-obsidian/70">
                        Seamlessly connects with the tools you already use
                    </p>
                </div>

                {/* ✅ NEW: Horizontal scrolling marquee animation */}
                <div className="relative">
                    <div className="flex animate-marquee gap-12">
                        {allPartners.map((partner, index) => (
                            <motion.div
                                key={`${partner.name}-${index}`}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: (index % partners.length) * 0.1 }}
                                className="group flex items-center justify-center flex-shrink-0"
                            >
                                <div className="relative h-12 w-36">
                                    {/* ✅ UPDATED: Removed grayscale - logos display in full color */}
                                    <Image
                                        src={partner.logo}
                                        alt={partner.name}
                                        fill
                                        className="object-contain opacity-80 transition-all duration-300 group-hover:opacity-100 group-hover:scale-105"
                                    />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
