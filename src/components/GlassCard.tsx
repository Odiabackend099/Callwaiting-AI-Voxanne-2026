"use client";

import React from "react";
import { motion } from "framer-motion";

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    hoverEffect?: boolean;
}

export const GlassCard = ({ children, className = "", hoverEffect = true }: GlassCardProps) => {
    return (
        <motion.div
            whileHover={hoverEffect ? { y: -5, scale: 1.01 } : {}}
            transition={{ duration: 0.2 }}
            className={`glass-card rounded-3xl p-8 ${className}`}
        >
            {children}
        </motion.div>
    );
};
