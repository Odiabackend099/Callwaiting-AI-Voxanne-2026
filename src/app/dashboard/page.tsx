'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Activity, CheckCircle, AlertCircle, Phone, Calendar, DollarSign, Zap, ChevronRight, Download, Play, Settings, PhoneCall, TrendingUp, Users, Clock, Mic, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';

// Navigation Component
function DashboardNav() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, logout } = useAuth();

    const navItems = [
        { label: 'Dashboard', href: '/dashboard', icon: Activity },
        { label: 'Voice Test', href: '/dashboard/voice-test', icon: Mic },
        { label: 'Settings', href: '/dashboard/settings', icon: Settings }
    ];

    return (
        <nav className="bg-white border-b border-gray-200 shadow-sm">
            <div className="max-w-7xl mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                                <Phone className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-xl font-bold text-gray-900">Voxanne</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href;
                                return (
                                    <button
                                        key={item.href}
                                        onClick={() => router.push(item.href)}
                                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium ${
                                            isActive
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-sm">
                            <p className="font-medium text-gray-900">{user?.email}</p>
                            <p className="text-gray-500">Account</p>
                        </div>
                        <button
                            onClick={() => {
                                logout();
                                router.push('/login');
                            }}
                            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}

export default function VoxanneDashboard() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [selectedPeriod, setSelectedPeriod] = useState('7d');

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-gray-600">Loading...</p>
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
        <>
            <DashboardNav />
            <div className="min-h-screen bg-white">
                <div className="max-w-7xl mx-auto px-6 py-8 pb-32">
                    {/* Header */}
                    <div className="mb-12">
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
                        <p className="text-gray-600">Welcome back! Here's your system overview.</p>
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                        {/* Total Calls */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                                    <Phone className="w-6 h-6 text-emerald-600" />
                                </div>
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" /> +12.5%
                                </span>
                            </div>
                            <h3 className="text-3xl font-bold text-gray-900 mb-1">{stats.totalCalls}</h3>
                            <p className="text-sm text-gray-600 font-medium mb-4">Total Calls</p>
                            <div className="pt-4 border-t border-gray-200">
                                <div className="flex items-center justify-between text-xs font-medium">
                                    <span className="text-gray-600">Today: {stats.callsToday}</span>
                                    <span className="text-emerald-600">98.1% answered</span>
                                </div>
                            </div>
                        </div>

                        {/* Bookings */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 rounded-xl bg-cyan-50 flex items-center justify-center">
                                    <Calendar className="w-6 h-6 text-cyan-600" />
                                </div>
                                <span className="text-xs font-bold text-cyan-600 bg-cyan-50 px-3 py-1 rounded-full flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" /> +24%
                                </span>
                            </div>
                            <h3 className="text-3xl font-bold text-gray-900 mb-1">{stats.bookings}</h3>
                            <p className="text-sm text-gray-600 font-medium mb-4">Appointments Booked</p>
                            <div className="pt-4 border-t border-gray-200">
                                <div className="flex items-center justify-between text-xs font-medium">
                                    <span className="text-gray-600">Today: {stats.bookingsToday}</span>
                                    <span className="text-cyan-600">15% conv. rate</span>
                                </div>
                            </div>
                        </div>

                        {/* Revenue */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                                    <DollarSign className="w-6 h-6 text-purple-600" />
                                </div>
                                <span className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" /> +31%
                                </span>
                            </div>
                            <h3 className="text-3xl font-bold text-gray-900 mb-1">£{(stats.revenue / 1000).toFixed(1)}k</h3>
                            <p className="text-sm text-gray-600 font-medium mb-4">Pipeline Revenue</p>
                            <div className="pt-4 border-t border-gray-200">
                                <div className="flex items-center justify-between text-xs font-medium">
                                    <span className="text-gray-600">Avg: £360/booking</span>
                                    <span className="text-purple-600">ROI: 12,300%</span>
                                </div>
                            </div>
                        </div>

                        {/* Response Time */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                                    <Zap className="w-6 h-6 text-amber-600" />
                                </div>
                                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                                    Excellent
                                </span>
                            </div>
                            <h3 className="text-3xl font-bold text-gray-900 mb-1">{stats.avgResponseTime}</h3>
                            <p className="text-sm text-gray-600 font-medium mb-4">Avg Response Time</p>
                            <div className="pt-4 border-t border-gray-200">
                                <div className="flex items-center justify-between text-xs font-medium">
                                    <span className="text-gray-600">Target: &lt;1s</span>
                                    <span className="text-amber-600">52% faster</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Recent Calls */}
                        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-1">Recent Calls</h3>
                                    <p className="text-sm text-gray-600">Live call activity and outcomes</p>
                                </div>
                                <button className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium flex items-center gap-2 text-gray-700">
                                    <Download className="w-4 h-4" />
                                    Export
                                </button>
                            </div>

                            <div className="space-y-4">
                                {recentCalls.map((call, idx) => (
                                    <div
                                        key={call.id}
                                        className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-gray-300 transition-all group cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${call.status === 'success' ? 'bg-emerald-50' :
                                                    call.status === 'escalated' ? 'bg-amber-50' : 'bg-cyan-50'
                                                    }`}>
                                                    {call.status === 'success' ? <CheckCircle className="w-6 h-6 text-emerald-600" /> :
                                                        call.status === 'escalated' ? <AlertCircle className="w-6 h-6 text-amber-600" /> :
                                                            <Phone className="w-6 h-6 text-cyan-600" />}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900">{call.caller}</h4>
                                                    <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                                                        <Clock className="w-3 h-3" />
                                                        {call.time} • {call.duration}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${call.type === 'Booking' ? 'bg-emerald-50 text-emerald-700' :
                                                    call.type === 'Medical' ? 'bg-amber-50 text-amber-700' :
                                                        call.type === 'Pricing' ? 'bg-cyan-50 text-cyan-700' :
                                                            'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {call.type}
                                                </span>
                                                {call.recording && (
                                                    <button className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-emerald-100 hover:text-emerald-600 transition-all flex items-center justify-center group/btn">
                                                        <Play className="w-4 h-4 fill-current group-hover/btn:scale-110 transition-transform" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pl-16">
                                            <p className="text-sm text-gray-700 font-medium">{call.outcome}</p>
                                            <div className="flex items-center gap-1 text-xs text-gray-600 group-hover:text-emerald-600 transition-colors font-medium">
                                                View Details
                                                <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button className="w-full mt-6 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-bold text-gray-700 flex items-center justify-center gap-2 group">
                                View All Activities
                                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </button>
                        </div>

                        {/* Upcoming Bookings & Status */}
                        <div className="space-y-6">
                            {/* Upcoming Bookings */}
                            <div className="bg-white border border-gray-200 rounded-2xl p-6">
                                <div className="mb-6">
                                    <h3 className="text-xl font-bold text-gray-900 mb-1">Upcoming</h3>
                                    <p className="text-sm text-gray-600">Next appointments</p>
                                </div>

                                <div className="space-y-4">
                                    {upcomingBookings.map((booking) => (
                                        <div key={booking.id} className="relative pl-6 pb-2 border-l border-gray-200 last:pb-0">
                                            <div className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${booking.status === 'confirmed' ? 'bg-emerald-600' : 'bg-amber-600'
                                                }`} />
                                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:border-gray-300 transition-all">
                                                <div className="flex justify-between items-start mb-1">
                                                    <h4 className="font-bold text-sm text-gray-900">{booking.patient}</h4>
                                                    <span className="text-xs font-bold text-emerald-600">£{booking.value.toLocaleString()}</span>
                                                </div>
                                                <p className="text-xs text-gray-600 mb-2">{booking.procedure}</p>
                                                <div className="flex items-center gap-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg px-2 py-1 inline-block">
                                                    <Calendar className="w-3 h-3" />
                                                    {booking.date} • {booking.time}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Safe Mode Status Banner */}
                            <div className="bg-gradient-to-br from-emerald-50 to-cyan-50 border border-emerald-200 rounded-2xl p-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0 animate-pulse">
                                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold mb-1 text-emerald-900">Safe Mode™ Active</h3>
                                        <p className="text-xs text-emerald-800 leading-relaxed mb-3">
                                            Zero medical advice incidents • 831 calls handled safely
                                        </p>
                                        <button className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1">
                                            View Report <ChevronRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
