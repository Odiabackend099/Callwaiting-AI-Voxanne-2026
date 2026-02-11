"use client";

import Image from "next/image";
import FadeIn from "@/components/ui/FadeIn";

const integrations = [
    {
        category: "Voice Infrastructure",
        tools: [
            { name: "Twilio", logo: "/integrations/twilio.png" },
            { name: "Vapi", logo: "/integrations/vapi.png" },
            { name: "ElevenLabs", logo: "/integrations/elevenlabs.png" },
            { name: "Vonage", logo: "/integrations/vonage.png" },
        ],
    },
    {
        category: "Calendars",
        tools: [
            { name: "Google Calendar", logo: "/integrations/google-calendar.png" },
            { name: "Outlook", logo: "/integrations/outlook.png" },
            { name: "Calendly", logo: "/integrations/calendly.png" },
            { name: "Cal.com", logo: "/integrations/cal-com.png" },
        ],
    },
    {
        category: "CRMs",
        tools: [
            { name: "Salesforce", logo: "/integrations/salesforce.png" },
            { name: "HubSpot", logo: "/integrations/hubspot.png" },
            { name: "Pipedrive", logo: "/integrations/pipedrive.png" },
            { name: "Monday.com", logo: "/integrations/monday.png" },
        ],
    },
];

export default function Integrations() {
    return (
        <section className="py-24 bg-surgical-50">
            <div className="max-w-7xl mx-auto px-6">
                <FadeIn>
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl font-bold text-obsidian tracking-tight mb-4">
                            Integrates with your existing stack
                        </h2>
                        <p className="text-lg text-obsidian/70">
                            No rip-and-replace. Voxanne connects to the tools you already use.
                        </p>
                    </div>
                </FadeIn>

                <div className="grid gap-12">
                    {integrations.map((row, rowIndex) => (
                        <FadeIn key={row.category} delay={rowIndex * 0.1}>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                {row.tools.map((tool) => (
                                    <div
                                        key={tool.name}
                                        className="bg-white rounded-xl p-6 shadow-sm border border-surgical-100 flex flex-col items-center justify-center h-32 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
                                    >
                                        <div className="relative w-14 h-14 flex items-center justify-center mb-2">
                                            <Image
                                                src={tool.logo}
                                                alt={`${tool.name} logo`}
                                                width={56}
                                                height={56}
                                                className="object-contain group-hover:scale-110 transition-transform duration-300"
                                                priority={false}
                                            />
                                        </div>
                                        <p className="text-sm font-medium text-obsidian/80 text-center leading-tight">
                                            {tool.name}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </FadeIn>
                    ))}
                </div>
            </div>
        </section>
    );
}
