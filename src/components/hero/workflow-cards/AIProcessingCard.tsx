import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';

export function AIProcessingCard() {
    return (
        <div className="w-80 rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
                <div className="rounded-full bg-gradient-to-br from-purple-500 to-purple-600 p-3">
                    <Bot className="h-6 w-6 text-white" />
                </div>
                <div className="text-sm font-medium text-gray-900">Voxanne AI</div>
            </div>

            <div className="rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 p-4">
                <div className="text-sm text-gray-700">
                    "Hi Sarah! I'd be happy to help you schedule a Botox consultation.
                    Let me check Dr. Martinez's availability..."
                </div>
            </div>

            {/* AI Waveform */}
            <div className="mt-4 flex items-end justify-center gap-1">
                {[...Array(8)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="w-2 rounded-full bg-gradient-to-t from-purple-500 to-blue-500"
                        animate={{
                            scaleY: [0.3, 1, 0.3],
                        }}
                        transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            delay: i * 0.1,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
