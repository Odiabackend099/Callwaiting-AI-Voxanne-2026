"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Lock } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        // Simulate login for demo
        setTimeout(() => {
            setIsLoading(false);
            alert("Login functionality would redirect to app.voxanne.ai");
        }, 1500);
    };

    return (
        <div className="min-h-screen grid lg:grid-cols-2 bg-white h-screen overflow-hidden">
            {/* Left Column: Form */}
            <div className="flex flex-col justify-center px-8 md:px-16 lg:px-24 xl:px-32 relative">
                <div className="absolute top-8 left-8 md:top-12 md:left-12">
                    <Link href="/" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-navy-900 transition-colors">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Voxanne
                    </Link>
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-sm mx-auto"
                >
                    <div className="mb-8">
                        <div className="h-12 w-12 bg-surgical-50 rounded-xl flex items-center justify-center text-surgical-600 mb-6">
                            <Lock className="w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-bold text-navy-900 mb-2">Welcome Back</h1>
                        <p className="text-slate-500">Secure access for clinical staff.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="email">Work Email</Label>
                            <Input id="email" type="email" placeholder="dr.smith@clinic.com" required className="h-12 bg-slate-50 border-slate-200 focus:ring-surgical-500 focus:border-surgical-500 rounded-lg" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Password</Label>
                                <Link href="#" className="text-sm font-medium text-surgical-600 hover:underline">Forgot password?</Link>
                            </div>
                            <Input id="password" type="password" required className="h-12 bg-slate-50 border-slate-200 focus:ring-surgical-500 focus:border-surgical-500 rounded-lg" />
                        </div>

                        <Button disabled={isLoading} type="submit" className="w-full h-12 bg-surgical-600 hover:bg-surgical-700 text-white font-semibold rounded-pill shadow-lg shadow-surgical-500/20 transition-all focus:ring-4 focus:ring-surgical-100">
                            {isLoading ? "Authenticating..." : "Sign In to Dashboard"}
                        </Button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-slate-100 text-center text-sm text-slate-500">
                        <p>Don&apos;t have an account? <Link href="/" className="text-surgical-600 font-semibold hover:underline">Contact Sales</Link></p>
                    </div>
                </motion.div>

                <div className="absolute bottom-8 left-0 right-0 text-center text-xs text-slate-400">
                    Protected by Call Waiting AI Security.
                </div>
            </div>

            {/* Right Column: Visual */}
            <div className="hidden lg:block bg-navy-900 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-navy-900 to-slate-900"></div>
                <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
                    backgroundSize: "32px 32px"
                }}></div>

                <div className="relative h-full flex flex-col justify-center items-center text-center p-16">
                    <div className="max-w-md">
                        <h2 className="text-4xl font-bold text-white mb-6">"The most trusted voice AI for medical professionals."</h2>
                        <p className="text-slate-400 text-lg">Join 500+ clinics automating their front desk with zero latency.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
