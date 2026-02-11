'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
}

/**
 * EmptyState — A premium, branded empty state component.
 * Used when a dashboard section has no data to display.
 *
 * Best practice: Never show raw "no data" text.
 * Always provide context + a clear next step.
 */
export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex flex-col items-center justify-center py-16 px-6 text-center"
        >
            {/* Icon container with branded background */}
            <div className="w-16 h-16 rounded-2xl bg-surgical-50 border border-surgical-200 flex items-center justify-center mb-5">
                <Icon className="w-7 h-7 text-surgical-600" />
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold text-obsidian tracking-tight mb-2">
                {title}
            </h3>

            {/* Description */}
            <p className="text-sm text-obsidian/60 max-w-sm leading-relaxed mb-6">
                {description}
            </p>

            {/* Optional CTA */}
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="
            text-sm font-semibold text-surgical-600
            bg-surgical-50 px-5 py-2.5 rounded-xl
            border border-surgical-200
            shadow-sm
            hover:shadow-md hover:bg-surgical-100
            hover:scale-105 hover:-translate-y-0.5
            active:scale-100
            focus:outline-none focus:ring-2 focus:ring-surgical-600/30
            transition-all duration-200
          "
                >
                    {actionLabel}
                </button>
            )}
        </motion.div>
    );
}
