"use client";
import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const demos = [
    { id: 1, name: "New Patient Booking", duration: "1:24" },
    { id: 2, name: "Rescheduling & FAQs", duration: "0:58" },
    { id: 3, name: "Post-Op Instructions", duration: "2:10" }
];

export function AudioDemos() {
    const [playing, setPlaying] = useState<number | null>(null);

    const togglePlay = (id: number) => {
        if (playing === id) {
            setPlaying(null);
        } else {
            setPlaying(id);
            // In a real app, this would trigger audio playback
        }
    };

    return (
        <Section className="bg-slate-50 border-y border-slate-100">
            <div className="text-center mb-16">
                <h2 className="text-3xl font-bold text-navy-900">Hear the Intelligence</h2>
                <p className="text-slate-600 mt-4">Listen to Voxanne handle complex patient scenarios in real-time.</p>
            </div>

            <div className="max-w-3xl mx-auto space-y-4">
                {demos.map((demo) => (
                    <div
                        key={demo.id}
                        className={cn(
                            "bg-white rounded-2xl p-4 md:p-6 flex items-center justify-between shadow-sm border border-slate-100 transition-all cursor-pointer hover:border-surgical-200",
                            playing === demo.id ? "ring-2 ring-surgical-100 border-surgical-300" : ""
                        )}
                        onClick={() => togglePlay(demo.id)}
                    >
                        <div className="flex items-center gap-4 md:gap-6">
                            <Button
                                size="icon"
                                className={cn(
                                    "rounded-full h-12 w-12 shrink-0 transition-all",
                                    playing === demo.id ? "bg-surgical-600 text-white" : "bg-surgical-50 text-surgical-600 hover:bg-surgical-100"
                                )}
                            >
                                {playing === demo.id ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                            </Button>
                            <div>
                                <h3 className="font-semibold text-navy-900 text-lg">{demo.name}</h3>
                                <p className="text-sm text-slate-500">AI Receptionist • {demo.duration}</p>
                            </div>
                        </div>

                        {/* Audio Wave Visualization (Fake) */}
                        <div className="hidden md:flex items-center gap-1 h-8">
                            {[...Array(20)].map((_, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "w-1 bg-surgical-200 rounded-full transition-all duration-300",
                                        playing === demo.id ? "animate-pulse bg-surgical-500" : ""
                                    )}
                                    style={{
                                        height: playing === demo.id
                                            ? `${Math.max(20, Math.random() * 100)}%`
                                            : `${30 + (i % 3) * 20}%`
                                    }}
                                ></div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </Section>
    );
}
