"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useMemo } from "react";
import { easings, useReducedMotion, createStaggerTransition } from "@/lib/animations";

interface TextRevealProps {
    /** The text to animate */
    text: string;
    /** Animation mode: 'chars' for character-by-character, 'words' for word-by-word */
    mode?: 'chars' | 'words';
    /** Delay before animation starts (in seconds) */
    delay?: number;
    /** Duration for each element animation (in seconds) */
    duration?: number;
    /** Delay between each element (in seconds) */
    stagger?: number;
    /** CSS className for the container */
    className?: string;
    /** CSS className for each animated element */
    elementClassName?: string;
    /** Trigger animation once or every time in view */
    once?: boolean;
    /** Animation variant: 'fadeUp', 'fadeScale', 'slideIn' */
    variant?: 'fadeUp' | 'fadeScale' | 'slideIn';
}

export default function TextReveal({
    text,
    mode = 'words',
    delay = 0,
    duration = 0.5,
    stagger = 0.03,
    className = "",
    elementClassName = "",
    once = true,
    variant = 'fadeUp',
}: TextRevealProps) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once, margin: "-50px" });
    const reducedMotion = useReducedMotion();

    // Split text into characters or words
    const elements = useMemo(() => {
        if (mode === 'chars') {
            // Split into characters, preserving spaces
            return text.split('').map((char, i) => ({
                content: char,
                key: `char-${i}`,
                isSpace: char === ' ',
            }));
        } else {
            // Split into words
            return text.split(' ').map((word, i) => ({
                content: word,
                key: `word-${i}`,
                isSpace: false,
            }));
        }
    }, [text, mode]);

    // Animation variants based on selected variant
    const getVariants = () => {
        switch (variant) {
            case 'fadeUp':
                return {
                    hidden: { opacity: 0, y: 20 },
                    visible: {
                        opacity: 1,
                        y: 0,
                        transition: { duration, ease: easings.smooth as any },
                    },
                };
            case 'fadeScale':
                return {
                    hidden: { opacity: 0, scale: 0.8 },
                    visible: {
                        opacity: 1,
                        scale: 1,
                        transition: { duration, ease: easings.bounce as any },
                    },
                };
            case 'slideIn':
                return {
                    hidden: { opacity: 0, x: -10 },
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

    const variants = getVariants();

    // Container variants with stagger
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: createStaggerTransition(stagger, delay),
        },
    };

    // If reduced motion, show text immediately without animation
    if (reducedMotion) {
        return (
            <div ref={ref} className={className}>
                {text}
            </div>
        );
    }

    return (
        <motion.div
            ref={ref}
            className={`${className} inline-block`}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={containerVariants}
            aria-label={text}
        >
            {elements.map((element) => {
                // For spaces in character mode, render non-breaking space
                if (element.isSpace) {
                    return (
                        <span key={element.key} className="inline-block">
                            &nbsp;
                        </span>
                    );
                }

                return (
                    <motion.span
                        key={element.key}
                        className={`${elementClassName} inline-block`}
                        variants={variants}
                        style={
                            mode === 'chars'
                                ? {}
                                : { marginRight: '0.25em' } // Add space between words
                        }
                    >
                        {element.content}
                    </motion.span>
                );
            })}
        </motion.div>
    );
}

/**
 * Pre-configured TextReveal variants for common use cases
 */

/**
 * Hero headline reveal - large, bold text with fadeUp animation
 */
export function HeroTextReveal({
    text,
    className = "text-5xl lg:text-7xl font-bold",
}: {
    text: string;
    className?: string;
}) {
    return (
        <TextReveal
            text={text}
            mode="words"
            variant="fadeUp"
            duration={0.6}
            stagger={0.05}
            className={className}
        />
    );
}

/**
 * Subtitle reveal - medium text with slideIn animation
 */
export function SubtitleTextReveal({
    text,
    className = "text-xl lg:text-2xl",
}: {
    text: string;
    className?: string;
}) {
    return (
        <TextReveal
            text={text}
            mode="words"
            variant="slideIn"
            duration={0.4}
            stagger={0.03}
            delay={0.2}
            className={className}
        />
    );
}

/**
 * Character-by-character reveal for special effects
 */
export function CharacterReveal({
    text,
    className = "",
}: {
    text: string;
    className?: string;
}) {
    return (
        <TextReveal
            text={text}
            mode="chars"
            variant="fadeScale"
            duration={0.3}
            stagger={0.02}
            className={className}
        />
    );
}
