import type { Metadata } from "next";
import DashboardGate from './DashboardGate';
import { VoiceAgentProvider } from '@/contexts/VoiceAgentContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import LeftSidebar from '@/components/dashboard/LeftSidebar';
import CommandPalette from '@/components/dashboard/CommandPalette';

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
            <DashboardGate>
                <VoiceAgentProvider>
                    <div className="flex h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-300">
                        {/* Persistent Sidebar */}
                        <LeftSidebar />

                        {/* Main Content Area */}
                        <div className="flex-1 md:ml-64 pt-16 md:pt-0 overflow-y-auto">
                            {children}
                        </div>

                        {/* Command Palette */}
                        <CommandPalette />
                    </div>
                </VoiceAgentProvider>
            </DashboardGate>
        </ThemeProvider>
    );
}
