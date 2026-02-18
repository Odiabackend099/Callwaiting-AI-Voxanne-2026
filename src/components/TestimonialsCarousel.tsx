'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Star, Quote } from 'lucide-react';
import Image from 'next/image';

const testimonials = [
    {
        id: 1,
        rating: 5,
        quote: "We were missing 30+ calls a week. Since Voxanne, we've booked $47,000 in additional procedures in just the first month.",
        author: 'Dr. Jennifer Martinez',
        title: 'Owner',
        practice: 'Radiant Skin Dermatology',
        location: 'Miami, FL',
        image: '/images/testimonials/emma.png',
    },
    {
        id: 2,
        rating: 5,
        quote: "Setup was incredibly simple. We went live in 20 minutes and immediately saw the impact. Our front desk can finally focus on in-office patients.",
        author: 'Dr. Michael Chen',
        title: 'Medical Director',
        practice: 'Glow Aesthetics',
        location: 'Austin, TX',
        image: '/images/testimonials/michael.png',
    },
    {
        id: 3,
        rating: 5,
        quote: "The AI sounds so natural that patients don't even realize they're talking to a bot. It's like hiring the perfect receptionist who never sleeps.",
        author: 'Dr. Sarah Williams',
        title: 'Founder',
        practice: 'Bella Dermatology',
        location: 'Seattle, WA',
        image: '/images/testimonials/sarah.png',
    },
];

export function TestimonialsCarousel() {
    const [currentIndex, setCurrentIndex] = useState(0);

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
    };

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    };

    // Show 3 testimonials on desktop, sliding window
    const visibleTestimonials = [
        testimonials[currentIndex],
        testimonials[(currentIndex + 1) % testimonials.length],
        testimonials[(currentIndex + 2) % testimonials.length],
    ];

    return (
        <section className="relative py-32 bg-obsidian overflow-hidden">
            <div className="section-container relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-20"
                >
                    <h2 className="mb-5 font-sans font-bold text-4xl md:text-5xl lg:text-6xl text-white tracking-tight">
                        Loved by <span className="font-sans font-semibold text-surgical-300">Leading Clinics</span>
                    </h2>
                    <p className="text-lg text-white/50 max-w-2xl mx-auto">
                        See why top medical practices trust Voxanne to handle their patient communications.
                    </p>
                </motion.div>

                {/* Carousel */}
                <div className="relative">
                    <div className="grid gap-8 md:grid-cols-3">
                        {visibleTestimonials.map((testimonial, index) => (
                            <motion.div
                                key={`${testimonial.id}-${index}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: index * 0.1 }}
                                className="group relative rounded-2xl bg-white p-8 h-full flex flex-col"
                            >
                                {/* Quote Icon Background */}
                                <div className="absolute top-6 right-6 opacity-5">
                                    <Quote className="w-12 h-12 text-obsidian rotate-180" />
                                </div>

                                {/* 5-Star Rating */}
                                <div className="mb-6 flex gap-1">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} className="h-3.5 w-3.5 fill-surgical-600 text-surgical-600" />
                                    ))}
                                </div>

                                {/* Quote */}
                                <blockquote className="mb-8 flex-grow">
                                    <p className="text-base leading-relaxed text-obsidian/70 font-sans relative z-10">
                                        &ldquo;{testimonial.quote}&rdquo;
                                    </p>
                                </blockquote>

                                {/* Author */}
                                <div className="flex items-center gap-4 mt-auto pt-6 border-t border-surgical-100">
                                    <div className="relative h-12 w-12 overflow-hidden rounded-full border border-surgical-200">
                                        <Image
                                            src={testimonial.image}
                                            alt={testimonial.author}
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-obsidian text-sm">
                                            {testimonial.author}
                                        </div>
                                        <div className="text-xs text-surgical-600 font-medium">
                                            {testimonial.title}, {testimonial.practice}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Navigation Arrows */}
                    <button
                        onClick={handlePrev}
                        className="absolute left-0 top-1/2 -translate-x-4 -translate-y-1/2 rounded-full bg-white/10 border border-white/20 p-3 hover:bg-white/20 text-white transition-all duration-500 md:-translate-x-12"
                        aria-label="Previous testimonial"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                        onClick={handleNext}
                        className="absolute right-0 top-1/2 translate-x-4 -translate-y-1/2 rounded-full bg-white/10 border border-white/20 p-3 hover:bg-white/20 text-white transition-all duration-500 md:translate-x-12"
                        aria-label="Next testimonial"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>

                    {/* Progress Dots */}
                    <div className="mt-12 flex justify-center gap-2">
                        {testimonials.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentIndex(index)}
                                className={`h-1.5 rounded-full transition-all duration-500 ${index === currentIndex
                                    ? 'w-8 bg-surgical-400'
                                    : 'w-1.5 bg-white/20 hover:bg-white/40'
                                    }`}
                                aria-label={`Go to testimonial group ${index + 1}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
