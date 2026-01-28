"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface FadeInProps {
    children: React.ReactNode;
    className?: string;
    delay?: number;
}

export default function FadeIn({ children, className, delay = 0 }: FadeInProps) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-50px" });

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
            animate={isInView ? {
                opacity: 1,
                y: 0,
                filter: "blur(0px)"
            } : {}}
            transition={{
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1],
                delay: delay,
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}
