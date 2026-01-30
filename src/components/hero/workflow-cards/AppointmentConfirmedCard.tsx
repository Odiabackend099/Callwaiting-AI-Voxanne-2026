import { motion } from 'framer-motion';
import { CheckCircle2, Smartphone } from 'lucide-react';

export function AppointmentConfirmedCard() {
    // Simple confetti particles (12 total)
    const confetti = Array.from({ length: 12 }, (_, i) => ({
        x: Math.cos((i * 30 * Math.PI) / 180) * 100,
        y: -Math.sin((i * 30 * Math.PI) / 180) * 100,
        color: ['#006BFF', '#8B5CF6', '#EC4899', '#10B981'][i % 4],
    }));

    return (
        <div className="relative w-80 rounded-2xl bg-white p-6 shadow-xl">
            {/* Confetti */}
            {confetti.map((particle, i) => (
                <motion.div
                    key={i}
                    className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
                    style={{ backgroundColor: particle.color }}
                    initial={{ x: 0, y: 0, opacity: 1 }}
                    animate={{
                        x: particle.x,
                        y: particle.y,
                        opacity: 0
                    }}
                    transition={{ duration: 1.5, delay: i * 0.1 }}
                />
            ))}

            {/* Success Checkmark */}
            <div className="mb-4 flex justify-center">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 p-4"
                >
                    <CheckCircle2 className="h-12 w-12 text-white" />
                </motion.div>
            </div>

            <div className="text-center">
                <h3 className="mb-2 text-xl font-bold text-gray-900">
                    Appointment Booked!
                </h3>
                <div className="space-y-1 text-sm text-gray-600">
                    <div>Sarah Johnson</div>
                    <div>Botox Consultation</div>
                    <div className="font-semibold text-gray-900">Tomorrow at 2:00 PM</div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
                    <Smartphone className="h-4 w-4" />
                    <span>Confirmation sent via SMS</span>
                </div>
            </div>
        </div>
    );
}
