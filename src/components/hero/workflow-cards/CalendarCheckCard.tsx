import { motion } from 'framer-motion';
import { Calendar, Check } from 'lucide-react';

const timeSlots = [
    { time: '2:00 PM', available: true },
    { time: '3:00 PM', available: true },
    { time: '4:00 PM', available: false },
];

export function CalendarCheckCard() {
    return (
        <div className="w-80 rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
                <div className="rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 p-3">
                    <Calendar className="h-6 w-6 text-white" />
                </div>
                <div className="text-sm font-medium text-gray-900">Checking Availability</div>
            </div>

            <div className="space-y-2">
                {timeSlots.map((slot, index) => (
                    <motion.div
                        key={slot.time}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.2 }}
                        className={`flex items-center justify-between rounded-lg p-3 ${slot.available
                                ? 'border-2 border-emerald-500 bg-emerald-50'
                                : 'border border-gray-200 bg-gray-50 opacity-50'
                            }`}
                    >
                        <span className="text-sm font-medium text-gray-900">
                            Tomorrow {slot.time}
                        </span>
                        {slot.available && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: index * 0.2 + 0.3, type: 'spring' }}
                            >
                                <Check className="h-5 w-5 text-emerald-600" />
                            </motion.div>
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
