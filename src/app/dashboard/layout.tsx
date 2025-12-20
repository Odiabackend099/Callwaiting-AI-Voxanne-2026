import type { Metadata } from "next";
import DashboardGate from './DashboardGate';
import { VoiceAgentProvider } from '@/contexts/VoiceAgentContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

export const metadata: Metadata = {
    title: "Call Waiting AI AI - Voice Agent Dashboard",
    description: "Manage and test your Call Waiting AI AI voice agent",
};

export default function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <ThemeProvider>
            <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-300">
                <DashboardGate>
                    <VoiceAgentProvider>{children}</VoiceAgentProvider>
                </DashboardGate>
            </div>
        </ThemeProvider>
    );
}
