import { motion } from 'framer-motion';
import { Phone } from 'lucide-react';

export function CallIncomingCard() {
    return (
        <div className="w-80 rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
                <motion.div
                    className="rounded-full bg-gradient-to-br from-blue-500 to-blue-600 p-3"
                    animate={{
                        scale: [1, 1.1, 1],
                        boxShadow: [
                            '0 0 0 0 rgba(59, 130, 246, 0.4)',
                            '0 0 0 20px rgba(59, 130, 246, 0)',
                        ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    <Phone className="h-6 w-6 text-white" />
                </motion.div>
                <div>
                    <div className="text-sm font-medium text-gray-600">Incoming Call</div>
                    <div className="text-xs text-gray-400">(555) 123-4567</div>
                </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
                <div className="mb-2 text-sm font-semibold text-gray-900">Sarah Johnson</div>
                <div className="text-sm text-gray-600">
                    "Hi, I'd like to book a Botox appointment"
                </div>
            </div>

            {/* Waveform Animation */}
            <div className="mt-4 flex items-end justify-center gap-1">
                {[...Array(8)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="w-1 rounded-full bg-blue-500"
                        animate={{
                            height: [12, 24, 12],
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
