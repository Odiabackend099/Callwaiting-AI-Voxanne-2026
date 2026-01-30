"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { easings, useReducedMotion, createStaggerTransition } from "@/lib/animations";

interface StaggerGridProps {
    /** Child elements to animate */
    children: React.ReactNode;
    /** Responsive column configuration */
    columns?: {
        mobile: number;
        tablet: number;
        desktop: number;
    };
    /** Gap between grid items in Tailwind units (default: 6) */
    gap?: number;
    /** Delay between each child animation in seconds (default: 0.1) */
    stagger?: number;
    /** Initial delay before first child animates in seconds (default: 0.2) */
    delay?: number;
    /** Animation duration for each child in seconds (default: 0.6) */
    duration?: number;
    /** Container CSS className */
    className?: string;
    /** Trigger animation once or every time in view (default: true) */
    once?: boolean;
    /** Animation variant: 'fadeUp', 'fadeScale', 'slideIn' */
    variant?: 'fadeUp' | 'fadeScale' | 'slideIn';
}

export default function StaggerGrid({
    children,
    columns = { mobile: 1, tablet: 2, desktop: 3 },
    gap = 6,
    stagger = 0.1,
    delay = 0.2,
    duration = 0.6,
    className = "",
    once = true,
    variant = 'fadeUp',
}: StaggerGridProps) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once, margin: "-100px" });
    const reducedMotion = useReducedMotion();

    // Grid column classes based on breakpoints
    const gridCols = `grid-cols-${columns.mobile} md:grid-cols-${columns.tablet} lg:grid-cols-${columns.desktop}`;
    const gridGap = `gap-${gap}`;

    // Animation variants based on selected variant
    const getChildVariants = () => {
        switch (variant) {
            case 'fadeUp':
                return {
                    hidden: { opacity: 0, y: 30, filter: "blur(4px)" },
                    visible: {
                        opacity: 1,
                        y: 0,
                        filter: "blur(0px)",
                        transition: { duration, ease: easings.smooth as any },
                    },
                };
            case 'fadeScale':
                return {
                    hidden: { opacity: 0, scale: 0.9 },
                    visible: {
                        opacity: 1,
                        scale: 1,
                        transition: { duration, ease: easings.antiGravity as any },
                    },
                };
            case 'slideIn':
                return {
                    hidden: { opacity: 0, x: -20 },
                    visible: {
                        opacity: 1,
                        x: 0,
                        transition: { duration, ease: easings.professional as any },
                    },
                };
            default:
                return {
                    hidden: { opacity: 0 },
                    visible: { opacity: 1 },
                };
        }
    };

    const childVariants = getChildVariants();

    // Container variants with stagger
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: createStaggerTransition(stagger, delay),
        },
    };

    // If reduced motion, show grid immediately without animation
    if (reducedMotion) {
        return (
            <div ref={ref} className={`grid ${gridCols} ${gridGap} ${className}`}>
                {children}
            </div>
        );
    }

    // Convert children to array for mapping
    const childrenArray = Array.isArray(children) ? children : [children];

    return (
        <motion.div
            ref={ref}
            className={`grid ${gridCols} ${gridGap} ${className}`}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={containerVariants}
        >
            {childrenArray.map((child, index) => (
                <motion.div key={index} variants={childVariants}>
                    {child}
                </motion.div>
            ))}
        </motion.div>
    );
}

/**
 * Pre-configured StaggerGrid variants for common use cases
 */

/**
 * Feature grid - 2 columns on tablet, 2 on desktop (classic feature layout)
 */
export function FeatureGrid({
    children,
    className = "",
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <StaggerGrid
            columns={{ mobile: 1, tablet: 2, desktop: 2 }}
            gap={8}
            stagger={0.1}
            variant="fadeUp"
            duration={0.7}
            className={className}
        >
            {children}
        </StaggerGrid>
    );
}

/**
 * Pricing grid - 1 column mobile, 2 tablet, 3 desktop (standard pricing tiers)
 */
export function PricingGrid({
    children,
    className = "",
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <StaggerGrid
            columns={{ mobile: 1, tablet: 2, desktop: 3 }}
            gap={8}
            stagger={0.15}
            variant="fadeScale"
            duration={0.6}
            className={className}
        >
            {children}
        </StaggerGrid>
    );
}

/**
 * Testimonial grid - 1 column mobile, 2 tablet, 3 desktop
 */
export function TestimonialGrid({
    children,
    className = "",
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <StaggerGrid
            columns={{ mobile: 1, tablet: 2, desktop: 3 }}
            gap={6}
            stagger={0.12}
            variant="fadeUp"
            duration={0.5}
            className={className}
        >
            {children}
        </StaggerGrid>
    );
}

/**
 * Logo grid - 2 mobile, 4 tablet, 6 desktop (partner logos, integrations)
 */
export function LogoGrid({
    children,
    className = "",
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <StaggerGrid
            columns={{ mobile: 2, tablet: 4, desktop: 6 }}
            gap={8}
            stagger={0.05}
            variant="fadeScale"
            duration={0.4}
            className={className}
        >
            {children}
        </StaggerGrid>
    );
}

/**
 * Blog/Card grid - 1 mobile, 2 tablet, 3 desktop (blog posts, cards)
 */
export function CardGrid({
    children,
    className = "",
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <StaggerGrid
            columns={{ mobile: 1, tablet: 2, desktop: 3 }}
            gap={6}
            stagger={0.08}
            variant="slideIn"
            duration={0.5}
            className={className}
        >
            {children}
        </StaggerGrid>
    );
}
