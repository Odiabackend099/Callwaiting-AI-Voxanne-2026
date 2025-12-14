'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, CheckCircle, AlertCircle, Phone, Calendar, DollarSign, Zap, ChevronRight, Download, Play, Settings, PhoneCall, TrendingUp, Users, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AuroraBackground } from '@/components/AuroraBackground';
import { GlassCard } from '@/components/GlassCard';
import { motion, useScroll, useTransform } from 'framer-motion';

export default function VoxanneDashboard() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [selectedPeriod, setSelectedPeriod] = useState('7d');
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({ container: containerRef });

    // Parallax transforms
    const headerY = useTransform(scrollYProgress, [0, 0.2], [0, -20]);
    const metricsY = useTransform(scrollYProgress, [0, 0.2], [0, -10]);
    const contentY = useTransform(scrollYProgress, [0, 0.2], [0, 0]);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-slate-700 border-t-cyan-400 rounded-full animate-spin" />
                    <p className="text-slate-400">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    const stats = {
        totalCalls: 847,
        answeredCalls: 831,
        missedCalls: 16,
        bookings: 127,
        revenue: 45800,
        avgResponseTime: '0.48s',
        callsToday: 34,
        bookingsToday: 5
    };

    const recentCalls = [
        { id: 1, caller: 'Sarah Mitchell', time: '2 mins ago', duration: '1:24', type: 'Booking', outcome: 'Booked - BBL Consult', status: 'success', recording: true },
        { id: 2, caller: 'James Parker', time: '8 mins ago', duration: '0:42', type: 'Pricing', outcome: 'Follow-up Scheduled', status: 'success', recording: true },
        { id: 3, caller: 'Emma Wilson', time: '15 mins ago', duration: '2:11', type: 'Medical', outcome: 'Escalated to Nurse', status: 'escalated', recording: true },
        { id: 4, caller: 'Michael Chen', time: '23 mins ago', duration: '1:05', type: 'Booking', outcome: 'Booked - Rhinoplasty', status: 'success', recording: true },
        { id: 5, caller: 'Lisa Anderson', time: '31 mins ago', duration: '0:38', type: 'Info', outcome: 'General Inquiry', status: 'info', recording: true },
    ];

    const upcomingBookings = [
        { id: 1, patient: 'Sarah Mitchell', procedure: 'BBL Consultation', date: 'Today', time: '2:00 PM', status: 'confirmed', value: 9500 },
        { id: 2, patient: 'Michael Chen', procedure: 'Rhinoplasty Consult', date: 'Tomorrow', time: '10:30 AM', status: 'confirmed', value: 8500 },
        { id: 3, patient: 'Emma Davis', procedure: 'Botox Treatment', date: 'Dec 16', time: '3:00 PM', status: 'pending', value: 450 },
        { id: 4, patient: 'James Wilson', procedure: 'Breast Aug Consult', date: 'Dec 17', time: '11:00 AM', status: 'confirmed', value: 6800 },
    ];

    const performanceData = [
        { day: 'Mon', calls: 98, bookings: 14, revenue: 6400 },
        { day: 'Tue', calls: 112, bookings: 18, revenue: 8100 },
        { day: 'Wed', calls: 125, bookings: 21, revenue: 9200 },
        { day: 'Thu', calls: 134, bookings: 19, revenue: 8800 },
        { day: 'Fri', calls: 156, bookings: 26, revenue: 11500 },
        { day: 'Sat', calls: 145, bookings: 20, revenue: 9300 },
        { day: 'Sun', calls: 77, bookings: 9, revenue: 4500 },
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                type: "spring",
                stiffness: 100
            }
        }
    };

    return (
        <AuroraBackground>
            <div ref={containerRef} className="h-screen overflow-y-auto w-full relative z-10 scrollbar-hide">
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                    className="max-w-7xl mx-auto px-6 py-8 pb-32"
                >
                    {/* Header */}
                    <motion.header
                        style={{ y: headerY }}
                        variants={itemVariants}
                        className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6"
                    >
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                    <Activity className="w-8 h-8 text-white relative z-10" />
                                </div>
                                <div className="absolute inset-0 bg-emerald-400/30 blur-xl rounded-full" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-slate-400">
                                    Voxanne Dashboard
                                </h1>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <p className="text-sm text-slate-400 font-medium">Elite Aesthetics Clinic • Live System Active</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <GlassCard className="!p-1 !rounded-xl !bg-slate-800/80 backdrop-blur-md">
                                <div className="flex items-center gap-1">
                                    {['24h', '7d', '30d', '90d'].map(period => (
                                        <button
                                            key={period}
                                            onClick={() => setSelectedPeriod(period)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 relative overflow-hidden ${selectedPeriod === period
                                                ? 'text-white'
                                                : 'text-slate-400 hover:text-white'
                                                }`}
                                        >
                                            {selectedPeriod === period && (
                                                <motion.div
                                                    layoutId="period-selector"
                                                    className="absolute inset-0 bg-gradient-to-r from-emerald-500/80 to-cyan-500/80 rounded-lg"
                                                />
                                            )}
                                            <span className="relative z-10">
                                                {period === '24h' ? 'Today' : period === '7d' ? 'Week' : period === '30d' ? 'Month' : 'Quarter'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </GlassCard>

                            <button onClick={() => router.push('/dashboard/settings')} className="group relative px-6 py-3 rounded-xl bg-slate-800/80 border border-white/10 text-white font-semibold transition-all hover:scale-105 active:scale-95 hover:border-purple-500/30">
                                <div className="flex items-center gap-2">
                                    <Settings className="w-5 h-5 text-purple-400" />
                                    <span>Settings</span>
                                </div>
                            </button>

                            <button onClick={() => router.push('/dashboard/agent-console')} className="group relative px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/25">
                                <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="flex items-center gap-2">
                                    <PhoneCall className="w-5 h-5" />
                                    <span>Agent Console</span>
                                </div>
                            </button>
                        </div>
                    </motion.header>

                    {/* Key Metrics Grid */}
                    <motion.div
                        style={{ y: metricsY }}
                        variants={containerVariants}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
                    >
                        {/* Total Calls */}
                        <motion.div variants={itemVariants}>
                            <GlassCard className="relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                                <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 duration-500">
                                    <Phone className="w-16 h-16 text-emerald-500/10" />
                                </div>
                                <div className="flex items-start justify-between mb-4 relative z-10">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center border border-emerald-500/10">
                                        <Phone className="w-6 h-6 text-emerald-400" />
                                    </div>
                                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/10 flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" /> +12.5%
                                    </span>
                                </div>
                                <div className="relative z-10">
                                    <h3 className="text-4xl font-bold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">{stats.totalCalls}</h3>
                                    <p className="text-sm text-slate-400 font-medium">Total Calls</p>
                                </div>
                                <div className="mt-6 pt-4 border-t border-white/5 relative z-10">
                                    <div className="flex items-center justify-between text-xs font-medium">
                                        <span className="text-slate-500">Today: {stats.callsToday}</span>
                                        <span className="text-emerald-400">98.1% answered</span>
                                    </div>
                                </div>
                            </GlassCard>
                        </motion.div>

                        {/* Bookings */}
                        <motion.div variants={itemVariants}>
                            <GlassCard className="relative overflow-hidden group hover:border-cyan-500/30 transition-colors">
                                <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 duration-500">
                                    <Calendar className="w-16 h-16 text-cyan-500/10" />
                                </div>
                                <div className="flex items-start justify-between mb-4 relative z-10">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 flex items-center justify-center border border-cyan-500/10">
                                        <Calendar className="w-6 h-6 text-cyan-400" />
                                    </div>
                                    <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-3 py-1.5 rounded-full border border-cyan-500/10 flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" /> +24%
                                    </span>
                                </div>
                                <div className="relative z-10">
                                    <h3 className="text-4xl font-bold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">{stats.bookings}</h3>
                                    <p className="text-sm text-slate-400 font-medium">Appointments Booked</p>
                                </div>
                                <div className="mt-6 pt-4 border-t border-white/5 relative z-10">
                                    <div className="flex items-center justify-between text-xs font-medium">
                                        <span className="text-slate-500">Today: {stats.bookingsToday}</span>
                                        <span className="text-cyan-400">15% conv. rate</span>
                                    </div>
                                </div>
                            </GlassCard>
                        </motion.div>

                        {/* Revenue */}
                        <motion.div variants={itemVariants}>
                            <GlassCard className="relative overflow-hidden group hover:border-purple-500/30 transition-colors">
                                <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 duration-500">
                                    <DollarSign className="w-16 h-16 text-purple-500/10" />
                                </div>
                                <div className="flex items-start justify-between mb-4 relative z-10">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center border border-purple-500/10">
                                        <DollarSign className="w-6 h-6 text-purple-400" />
                                    </div>
                                    <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-3 py-1.5 rounded-full border border-purple-500/10 flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" /> +31%
                                    </span>
                                </div>
                                <div className="relative z-10">
                                    <h3 className="text-4xl font-bold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">£{(stats.revenue / 1000).toFixed(1)}k</h3>
                                    <p className="text-sm text-slate-400 font-medium">Pipeline Revenue</p>
                                </div>
                                <div className="mt-6 pt-4 border-t border-white/5 relative z-10">
                                    <div className="flex items-center justify-between text-xs font-medium">
                                        <span className="text-slate-500">Avg: £360/booking</span>
                                        <span className="text-purple-400">ROI: 12,300%</span>
                                    </div>
                                </div>
                            </GlassCard>
                        </motion.div>

                        {/* Response Time */}
                        <motion.div variants={itemVariants}>
                            <GlassCard className="relative overflow-hidden group hover:border-amber-500/30 transition-colors">
                                <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 duration-500">
                                    <Zap className="w-16 h-16 text-amber-500/10" />
                                </div>
                                <div className="flex items-start justify-between mb-4 relative z-10">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center border border-amber-500/10">
                                        <Zap className="w-6 h-6 text-amber-400" />
                                    </div>
                                    <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/10 flex items-center gap-1">
                                        Excellent
                                    </span>
                                </div>
                                <div className="relative z-10">
                                    <h3 className="text-4xl font-bold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">{stats.avgResponseTime}</h3>
                                    <p className="text-sm text-slate-400 font-medium">Avg Response Time</p>
                                </div>
                                <div className="mt-6 pt-4 border-t border-white/5 relative z-10">
                                    <div className="flex items-center justify-between text-xs font-medium">
                                        <span className="text-slate-500">Target: &lt;1s</span>
                                        <span className="text-amber-400">52% faster</span>
                                    </div>
                                </div>
                            </GlassCard>
                        </motion.div>
                    </motion.div>

                    {/* Main Content Grid */}
                    <motion.div
                        style={{ y: contentY }}
                        variants={containerVariants}
                        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                    >
                        {/* Recent Calls */}
                        <motion.div variants={itemVariants} className="lg:col-span-2">
                            <GlassCard className="h-full">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h3 className="text-2xl font-bold mb-1">Recent Calls</h3>
                                        <p className="text-sm text-slate-400">Live call activity and outcomes</p>
                                    </div>
                                    <button className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-sm font-medium flex items-center gap-2 border border-white/5">
                                        <Download className="w-4 h-4" />
                                        Export
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {recentCalls.map((call, idx) => (
                                        <motion.div
                                            key={call.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.1 }}
                                            className="bg-slate-900/40 rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-all group cursor-pointer"
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${call.status === 'success' ? 'bg-emerald-500/10' :
                                                        call.status === 'escalated' ? 'bg-amber-500/10' : 'bg-cyan-500/10'
                                                        }`}>
                                                        {call.status === 'success' ? <CheckCircle className="w-6 h-6 text-emerald-400" /> :
                                                            call.status === 'escalated' ? <AlertCircle className="w-6 h-6 text-amber-400" /> :
                                                                <Phone className="w-6 h-6 text-cyan-400" />}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-lg">{call.caller}</h4>
                                                        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                                                            <Clock className="w-3 h-3" />
                                                            {call.time} • {call.duration}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${call.type === 'Booking' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10' :
                                                        call.type === 'Medical' ? 'bg-amber-500/10 text-amber-400 border-amber-500/10' :
                                                            call.type === 'Pricing' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/10' :
                                                                'bg-slate-500/10 text-slate-400 border-slate-500/10'
                                                        }`}>
                                                        {call.type}
                                                    </span>
                                                    {call.recording && (
                                                        <button className="w-10 h-10 rounded-xl bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 transition-all flex items-center justify-center group/btn">
                                                            <Play className="w-4 h-4 fill-current group-hover/btn:scale-110 transition-transform" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between pl-16">
                                                <p className="text-sm text-slate-300 font-medium">{call.outcome}</p>
                                                <div className="flex items-center gap-1 text-xs text-slate-500 group-hover:text-emerald-400 transition-colors font-medium">
                                                    View Details
                                                    <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>

                                <button className="w-full mt-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all text-sm font-bold border border-white/5 flex items-center justify-center gap-2 group">
                                    View All Activities
                                    <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                </button>
                            </GlassCard>
                        </motion.div>

                        {/* Recent Changes Side Panel */}
                        <motion.div variants={itemVariants} className="space-y-6">
                            {/* Upcoming Bookings */}
                            <GlassCard>
                                <div className="mb-6">
                                    <h3 className="text-xl font-bold mb-1">Upcoming</h3>
                                    <p className="text-sm text-slate-400">Next appointments</p>
                                </div>

                                <div className="space-y-4">
                                    {upcomingBookings.map((booking, idx) => (
                                        <div key={booking.id} className="relative pl-6 pb-2 border-l border-white/10 last:pb-0">
                                            <div className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${booking.status === 'confirmed' ? 'bg-emerald-500' : 'bg-amber-500'
                                                }`} />
                                            <div className="bg-white/5 rounded-xl p-3 border border-white/5 hover:border-white/10 transition-all">
                                                <div className="flex justify-between items-start mb-1">
                                                    <h4 className="font-bold text-sm">{booking.patient}</h4>
                                                    <span className="text-xs font-bold text-emerald-400">£{booking.value.toLocaleString()}</span>
                                                </div>
                                                <p className="text-xs text-slate-400 mb-2">{booking.procedure}</p>
                                                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-black/20 rounded-lg px-2 py-1 inline-block">
                                                    <Calendar className="w-3 h-3" />
                                                    {booking.date} • {booking.time}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </GlassCard>

                            {/* Safe Mode Status Banner */}
                            <GlassCard className="!bg-gradient-to-br !from-emerald-900/40 !to-cyan-900/40 !border-emerald-500/20">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold mb-1 text-emerald-100">Safe Mode™ Active</h3>
                                        <p className="text-xs text-emerald-200/70 leading-relaxed mb-3">
                                            Zero medical advice incidents • 831 calls handled safely
                                        </p>
                                        <button className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1">
                                            View Report <ChevronRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            </GlassCard>
                        </motion.div>
                    </motion.div>
                </motion.div>
            </div>
        </AuroraBackground>
    );
}
