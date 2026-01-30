'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
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
        image: '/images/testimonials/emma.png', // Woman - Dr. Jennifer Martinez
    },
    {
        id: 2,
        rating: 5,
        quote: "Setup was incredibly simple. We went live in 20 minutes and immediately saw the impact. Our front desk can finally focus on in-office patients.",
        author: 'Dr. Michael Chen',
        title: 'Medical Director',
        practice: 'Glow Aesthetics',
        location: 'Austin, TX',
        image: '/images/testimonials/michael.png', // Man - Dr. Michael Chen
    },
    {
        id: 3,
        rating: 5,
        quote: "The AI sounds so natural that patients don't even realize they're talking to a bot. It's like hiring the perfect receptionist who never sleeps.",
        author: 'Dr. Sarah Williams',
        title: 'Founder',
        practice: 'Bella Dermatology',
        location: 'Seattle, WA',
        image: '/images/testimonials/sarah.png', // Woman - Dr. Sarah Williams
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
        <section className="bg-white py-24">
            <div className="container mx-auto px-4">
                <h2 className="mb-4 text-center text-4xl font-bold text-gray-900">
                    What Clinic Owners Say
                </h2>
                <p className="mb-16 text-center text-lg text-gray-600">
                    Join 500+ practices transforming their patient experience
                </p>

                {/* Carousel */}
                <div className="relative">
                    <div className="grid gap-8 md:grid-cols-3">
                        {visibleTestimonials.map((testimonial, index) => (
                            <motion.div
                                key={`${testimonial.id}-${index}`} // Unique key for animation
                                initial={{ opacity: 0, x: 100 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -100 }}
                                transition={{ duration: 0.5 }}
                                className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
                            >
                                {/* 5-Star Rating */}
                                <div className="mb-4 flex gap-1">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                                    ))}
                                </div>

                                {/* Quote */}
                                <p className="mb-6 text-lg italic text-gray-700">
                                    "{testimonial.quote}"
                                </p>

                                {/* Author */}
                                <div className="flex items-center gap-4">
                                    <div className="relative h-16 w-16 overflow-hidden rounded-full">
                                        <Image
                                            src={testimonial.image}
                                            alt={testimonial.author}
                                            width={64}
                                            height={64}
                                            className="object-cover"
                                        />
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-900">{testimonial.author}</div>
                                        <div className="text-sm text-gray-600">
                                            {testimonial.title}, {testimonial.practice}
                                        </div>
                                        <div className="text-sm text-gray-500">{testimonial.location}</div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Navigation Arrows */}
                    <button
                        onClick={handlePrev}
                        className="absolute left-0 top-1/2 -translate-x-4 -translate-y-1/2 rounded-full bg-white p-3 shadow-lg hover:bg-gray-50 md:-translate-x-12"
                        aria-label="Previous testimonial"
                    >
                        <ChevronLeft className="h-6 w-6 text-gray-700" />
                    </button>
                    <button
                        onClick={handleNext}
                        className="absolute right-0 top-1/2 translate-x-4 -translate-y-1/2 rounded-full bg-white p-3 shadow-lg hover:bg-gray-50 md:translate-x-12"
                        aria-label="Next testimonial"
                    >
                        <ChevronRight className="h-6 w-6 text-gray-700" />
                    </button>

                    {/* Progress Dots */}
                    <div className="mt-8 flex justify-center gap-2">
                        {testimonials.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentIndex(index)}
                                className={`h-2 rounded-full transition-all ${index === currentIndex
                                        ? 'w-8 bg-blue-600'
                                        : 'w-2 bg-gray-300'
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
