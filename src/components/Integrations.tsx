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
        <section className="py-32 bg-white">
            <div className="section-container">
                <FadeIn>
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <h2 className="font-sans font-bold text-4xl md:text-5xl text-obsidian tracking-tight mb-5">
                            Integrates with your <span className="font-sans font-semibold">existing stack</span>
                        </h2>
                        <p className="text-lg text-obsidian/50">
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
                                        className="bg-surgical-50 rounded-xl p-6 border border-surgical-200 flex flex-col items-center justify-center h-32 hover:border-surgical-300 transition-all duration-500 group"
                                    >
                                        <div className="relative w-14 h-14 flex items-center justify-center mb-2">
                                            <Image
                                                src={tool.logo}
                                                alt={`${tool.name} logo`}
                                                width={56}
                                                height={56}
                                                className="object-contain opacity-70 group-hover:opacity-100 transition-opacity duration-500"
                                                priority={false}
                                            />
                                        </div>
                                        <p className="text-sm font-medium text-obsidian/60 text-center leading-tight">
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
