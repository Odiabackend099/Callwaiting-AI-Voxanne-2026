import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect } from 'react';
import { TrendingUp } from 'lucide-react';

export function DashboardUpdateCard() {
    const count = useMotionValue(0);
    const rounded = useTransform(count, (latest) => Math.round(latest));

    useEffect(() => {
        const controls = animate(count, 8400, { duration: 2 });
        return controls.stop;
    }, [count]);

    return (
        <div className="w-80 rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
                <div className="rounded-full bg-gradient-to-br from-pink-500 to-pink-600 p-3">
                    <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div className="text-sm font-medium text-gray-900">Revenue Captured</div>
            </div>

            <div className="mb-4 text-center">
                <div className="text-4xl font-bold text-gray-900">
                    $<motion.span>{rounded}</motion.span>
                </div>
                <div className="text-sm text-gray-600">Today's Revenue</div>
            </div>

            {/* Mini Bar Chart */}
            <div className="flex items-end justify-between gap-2">
                {[40, 60, 45, 80, 70, 100].map((height, i) => (
                    <motion.div
                        key={i}
                        className="w-8 rounded-t bg-gradient-to-t from-pink-500 to-purple-500"
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ delay: i * 0.1, duration: 0.5 }}
                    />
                ))}
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-emerald-600">
                <TrendingUp className="h-4 w-4" />
                <span>+23% vs yesterday</span>
            </div>
        </div>
    );
}
