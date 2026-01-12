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
                    <div className="flex h-screen overflow-hidden">
                        {/* Persistent Sidebar */}
                        <LeftSidebar />

                        {/* Main Content Area */}
                        {/* ml-64 matches sidebar 60 (15rem) + gaps, roughly. Let's make it 18rem (72) to be safe with the floating gap */}
                        <div className="flex-1 md:ml-72 flex flex-col h-full overflow-hidden relative">
                            {/* Command Palette */}
                            <CommandPalette />

                            <main className="flex-1 overflow-y-auto overflow-x-hidden pt-16 md:pt-4 pr-4 pb-4">
                                {children}
                            </main>
                        </div>
                    </div>
                </VoiceAgentProvider>
            </DashboardGate>
        </ThemeProvider>
    );
}
