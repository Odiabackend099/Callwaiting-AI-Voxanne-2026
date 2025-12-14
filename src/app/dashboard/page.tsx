'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, CheckCircle, AlertCircle, Phone, Calendar, DollarSign, Zap, ChevronRight, Download, Play, Settings, PhoneCall } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

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
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-slate-700 border-t-cyan-400 rounded-full animate-spin" />
                    <p className="text-slate-400">Loading your dashboard...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

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

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
            {/* Header */}
            <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                                <Activity className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">Voxanne Dashboard</h1>
                                <p className="text-sm text-slate-400">Elite Aesthetics Clinic</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <button onClick={() => router.push('/dashboard/voice-test')} className="px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-2">
                                <PhoneCall className="w-4 h-4" />
                                Test Voice Agent
                            </button>
                            <button onClick={() => router.push('/dashboard/settings')} className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all flex items-center justify-center">
                                <Settings className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Period Selector */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-bold mb-1">Practice Overview</h2>
                        <p className="text-slate-400">Real-time performance metrics and insights</p>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1">
                        {['24h', '7d', '30d', '90d'].map(period => (
                            <button
                                key={period}
                                onClick={() => setSelectedPeriod(period)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                    selectedPeriod === period
                                        ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {period === '24h' ? 'Today' : period === '7d' ? 'Week' : period === '30d' ? 'Month' : 'Quarter'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* Total Calls */}
                    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm hover:border-emerald-500/30 transition-all group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Phone className="w-6 h-6 text-emerald-400" />
                            </div>
                            <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">+12.5%</span>
                        </div>
                        <h3 className="text-3xl font-bold mb-1">{stats.totalCalls}</h3>
                        <p className="text-sm text-slate-400">Total Calls</p>
                        <div className="mt-4 pt-4 border-t border-slate-700/50">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500">Today: {stats.callsToday}</span>
                                <span className="text-emerald-400">98.1% answered</span>
                            </div>
                        </div>
                    </div>

                    {/* Bookings */}
                    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm hover:border-cyan-500/30 transition-all group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Calendar className="w-6 h-6 text-cyan-400" />
                            </div>
                            <span className="text-xs font-medium text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-full">+24%</span>
                        </div>
                        <h3 className="text-3xl font-bold mb-1">{stats.bookings}</h3>
                        <p className="text-sm text-slate-400">Appointments Booked</p>
                        <div className="mt-4 pt-4 border-t border-slate-700/50">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500">Today: {stats.bookingsToday}</span>
                                <span className="text-cyan-400">15% conv. rate</span>
                            </div>
                        </div>
                    </div>

                    {/* Revenue */}
                    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm hover:border-purple-500/30 transition-all group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <DollarSign className="w-6 h-6 text-purple-400" />
                            </div>
                            <span className="text-xs font-medium text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full">+31%</span>
                        </div>
                        <h3 className="text-3xl font-bold mb-1">£{(stats.revenue / 1000).toFixed(1)}k</h3>
                        <p className="text-sm text-slate-400">Pipeline Revenue</p>
                        <div className="mt-4 pt-4 border-t border-slate-700/50">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500">Avg: £360/booking</span>
                                <span className="text-purple-400">ROI: 12,300%</span>
                            </div>
                        </div>
                    </div>

                    {/* Response Time */}
                    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm hover:border-amber-500/30 transition-all group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Zap className="w-6 h-6 text-amber-400" />
                            </div>
                            <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">Excellent</span>
                        </div>
                        <h3 className="text-3xl font-bold mb-1">{stats.avgResponseTime}</h3>
                        <p className="text-sm text-slate-400">Avg Response Time</p>
                        <div className="mt-4 pt-4 border-t border-slate-700/50">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500">Target: &lt;1s</span>
                                <span className="text-amber-400">52% faster</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Recent Calls */}
                    <div className="lg:col-span-2 bg-gradient-to-br from-slate-800/30 to-slate-900/30 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-xl font-bold mb-1">Recent Calls</h3>
                                <p className="text-sm text-slate-400">Live call activity and outcomes</p>
                            </div>
                            <button className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all text-sm flex items-center gap-2">
                                <Download className="w-4 h-4" />
                                Export
                            </button>
                        </div>

                        <div className="space-y-3">
                            {recentCalls.map((call) => (
                                <div key={call.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 hover:border-slate-600 transition-all group">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                                call.status === 'success' ? 'bg-emerald-500/10' :
                                                call.status === 'escalated' ? 'bg-amber-500/10' : 'bg-cyan-500/10'
                                            }`}>
                                                {call.status === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> :
                                                 call.status === 'escalated' ? <AlertCircle className="w-5 h-5 text-amber-400" /> :
                                                 <Phone className="w-5 h-5 text-cyan-400" />}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold">{call.caller}</h4>
                                                <p className="text-xs text-slate-400">{call.time} • {call.duration}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                                call.type === 'Booking' ? 'bg-emerald-500/10 text-emerald-400' :
                                                call.type === 'Medical' ? 'bg-amber-500/10 text-amber-400' :
                                                call.type === 'Pricing' ? 'bg-cyan-500/10 text-cyan-400' :
                                                'bg-slate-500/10 text-slate-400'
                                            }`}>
                                                {call.type}
                                            </span>
                                            {call.recording && (
                                                <button className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-emerald-500/20 transition-all flex items-center justify-center group-hover:scale-110">
                                                    <Play className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-slate-300">{call.outcome}</p>
                                        <button className="text-xs text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1">
                                            View Details
                                            <ChevronRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button className="w-full mt-4 py-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-all text-sm font-medium border border-slate-700/50">
                            View All Calls
                        </button>
                    </div>

                    {/* Upcoming Bookings */}
                    <div className="bg-gradient-to-br from-slate-800/30 to-slate-900/30 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
                        <div className="mb-6">
                            <h3 className="text-xl font-bold mb-1">Upcoming</h3>
                            <p className="text-sm text-slate-400">Next appointments</p>
                        </div>

                        <div className="space-y-3">
                            {upcomingBookings.map((booking) => (
                                <div key={booking.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 hover:border-emerald-500/30 transition-all">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h4 className="font-semibold text-sm mb-1">{booking.patient}</h4>
                                            <p className="text-xs text-slate-400">{booking.procedure}</p>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-full ${
                                            booking.status === 'confirmed'
                                                ? 'bg-emerald-500/10 text-emerald-400'
                                                : 'bg-amber-500/10 text-amber-400'
                                        }`}>
                                            {booking.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/50">
                                        <span className="text-xs text-slate-400">{booking.date} • {booking.time}</span>
                                        <span className="text-xs font-medium text-emerald-400">£{booking.value.toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button onClick={() => router.push('/dashboard/settings')} className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:opacity-90 transition-all text-sm font-medium">
                            View Calendar
                        </button>
                    </div>
                </div>

                {/* Performance Chart */}
                <div className="mt-6 bg-gradient-to-br from-slate-800/30 to-slate-900/30 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-xl font-bold mb-1">Weekly Performance</h3>
                            <p className="text-sm text-slate-400">Calls, bookings, and revenue trends</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                                <span className="text-xs text-slate-400">Calls</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-cyan-400"></div>
                                <span className="text-xs text-slate-400">Bookings</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-purple-400"></div>
                                <span className="text-xs text-slate-400">Revenue</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-64 flex items-end justify-between gap-4">
                        {performanceData.map((data, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                                <div className="w-full flex flex-col items-center gap-1 h-full justify-end">
                                    <div
                                        className="w-full bg-gradient-to-t from-emerald-500/20 to-emerald-500/5 rounded-t-lg border-t-2 border-emerald-400 hover:from-emerald-500/30 transition-all relative group"
                                        style={{ height: `${(data.calls / 156) * 100}%` }}
                                    >
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                            {data.calls} calls
                                        </div>
                                    </div>
                                </div>
                                <span className="text-xs text-slate-400 font-medium">{data.day}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Safe Mode Status Banner */}
                <div className="mt-6 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-2xl p-6 border border-emerald-500/20 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold mb-1">Voxanne Safe Mode™ Active</h3>
                            <p className="text-sm text-slate-400">Zero medical advice incidents • 831 calls handled safely this week • All escalations completed in &lt;10 seconds</p>
                        </div>
                        <button className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all text-sm">
                            View Safety Report
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
