"use client";

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-clinical-bg text-obsidian flex flex-col items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
            >
                <h1 className="text-9xl font-bold bg-gradient-to-r from-surgical-400 to-surgical-700 bg-clip-text text-transparent mb-4">
                    404
                </h1>
                <h2 className="text-2xl font-bold text-obsidian mb-6">Page Not Found</h2>
                <p className="text-obsidian/60 max-w-md mx-auto mb-10">
                    The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                        href="/"
                        className="flex items-center gap-2 px-6 py-3 bg-surgical-600 text-white rounded-xl font-bold shadow-lg shadow-surgical-600/25 hover:shadow-xl hover:shadow-surgical-600/35 hover:scale-105 active:scale-100 transition-all duration-200"
                    >
                        <Home className="w-4 h-4" />
                        Go Home
                    </Link>
                    <button
                        onClick={() => window.history.back()}
                        className="flex items-center gap-2 px-6 py-3 bg-surgical-50 text-surgical-600 rounded-xl font-bold border border-surgical-200 hover:bg-surgical-100 hover:scale-105 active:scale-100 transition-all duration-200"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Go Back
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
