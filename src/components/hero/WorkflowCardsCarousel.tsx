'use client';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CallIncomingCard } from './workflow-cards/CallIncomingCard';
import { AIProcessingCard } from './workflow-cards/AIProcessingCard';
import { CalendarCheckCard } from './workflow-cards/CalendarCheckCard';
import { AppointmentConfirmedCard } from './workflow-cards/AppointmentConfirmedCard';
import { DashboardUpdateCard } from './workflow-cards/DashboardUpdateCard';

const cards = [
    { id: 'call-incoming', Component: CallIncomingCard },
    { id: 'ai-processing', Component: AIProcessingCard },
    { id: 'calendar-check', Component: CalendarCheckCard },
    { id: 'appointment-confirmed', Component: AppointmentConfirmedCard },
    { id: 'dashboard-update', Component: DashboardUpdateCard },
];

export function WorkflowCardsCarousel() {
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % cards.length);
        }, 3000); // 3 seconds per card

        return () => clearInterval(interval);
    }, []);

    const { Component } = cards[activeIndex];

    return (
        <div className="relative h-[600px] rounded-3xl bg-gradient-to-br from-[#006BFF] via-[#8B5CF6] to-[#EC4899] p-8">
            {/* Animated Card Container */}
            <div className="flex h-full items-center justify-center">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeIndex}
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -50, scale: 0.95 }}
                        transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
                    >
                        <Component />
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Progress Dots */}
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
                {cards.map((_, index) => (
                    <div
                        key={index}
                        className={`h-2 rounded-full transition-all duration-300 ${index === activeIndex
                                ? 'w-8 bg-white'
                                : 'w-2 bg-white/40'
                            }`}
                    />
                ))}
            </div>
        </div>
    );
}
