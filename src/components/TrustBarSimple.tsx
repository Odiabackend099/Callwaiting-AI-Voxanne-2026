'use client';
import Image from 'next/image';

const partners = [
    { name: 'Vapi', logo: '/integrations/vapi.png' },
    { name: 'Google Calendar', logo: '/integrations/google-calendar.png' },
    { name: 'Twilio', logo: '/integrations/twilio.png' },
    { name: 'Supabase', logo: '/integrations/supabase.png' },
];

export function TrustBarSimple() {
    return (
        <section className="bg-white py-14 border-y border-surgical-200/50 overflow-hidden">
            <div className="section-container mb-8 text-center">
                <h2 className="text-sm font-medium text-obsidian/40 uppercase tracking-widest mb-2">
                    Trusted Integrations
                </h2>
                <p className="text-sm text-obsidian/50">
                    Seamlessly connects with the tools you already use
                </p>
            </div>

            <div className="relative">
                {/* Edge fade gradients */}
                <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

                {/* Seamless marquee: two identical rows side-by-side */}
                <div className="flex">
                    <div className="flex animate-marquee items-center gap-16 pr-16 flex-shrink-0">
                        {partners.map((partner) => (
                            <div
                                key={partner.name}
                                className="group flex items-center gap-3 flex-shrink-0"
                            >
                                <div className="relative h-10 w-10 flex-shrink-0">
                                    <Image
                                        src={partner.logo}
                                        alt={partner.name}
                                        fill
                                        sizes="40px"
                                        className="object-contain opacity-70 group-hover:opacity-100 transition-all duration-300"
                                    />
                                </div>
                                <span className="text-sm font-semibold text-obsidian/40 group-hover:text-obsidian transition-colors duration-300 whitespace-nowrap">
                                    {partner.name}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="flex animate-marquee items-center gap-16 pr-16 flex-shrink-0" aria-hidden="true">
                        {partners.map((partner) => (
                            <div
                                key={partner.name}
                                className="group flex items-center gap-3 flex-shrink-0"
                            >
                                <div className="relative h-10 w-10 flex-shrink-0">
                                    <Image
                                        src={partner.logo}
                                        alt={partner.name}
                                        fill
                                        sizes="40px"
                                        className="object-contain opacity-70 group-hover:opacity-100 transition-all duration-300"
                                    />
                                </div>
                                <span className="text-sm font-semibold text-obsidian/40 group-hover:text-obsidian transition-colors duration-300 whitespace-nowrap">
                                    {partner.name}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
