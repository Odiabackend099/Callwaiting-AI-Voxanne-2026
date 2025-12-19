import type { Metadata } from "next";
import DashboardGate from './DashboardGate';
import { VoiceAgentProvider } from '@/contexts/VoiceAgentContext';

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
        <div className="min-h-screen bg-black text-white">
            <DashboardGate>
                <VoiceAgentProvider>{children}</VoiceAgentProvider>
            </DashboardGate>
        </div>
    );
}
