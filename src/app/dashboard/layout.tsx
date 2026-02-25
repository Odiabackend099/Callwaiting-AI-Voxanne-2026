import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from '@/lib/supabase/server';
import DashboardGate from './DashboardGate';
import { VoiceAgentProvider } from '@/contexts/VoiceAgentContext';
import { DashboardWebSocketProvider } from '@/contexts/DashboardWebSocketContext';
import LeftSidebar from '@/components/dashboard/LeftSidebar';
import CommandPalette from '@/components/dashboard/CommandPalette';
import { BackendStatusBanner } from '@/components/dashboard/BackendStatusBanner';
import { EmailVerificationBanner } from '@/components/dashboard/EmailVerificationBanner';

export const metadata: Metadata = {
    title: "Voxanne AI - Voice Agent Dashboard",
    description: "Manage and test your Voxanne AI voice agent",
};

export default async function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // Server-side auth check: validates JWT and ensures org_id is present.
    // Middleware already handles redirects, but this is defense-in-depth.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Only trust app_metadata.org_id (admin-set, cryptographically signed).
    // Never fall back to user_metadata which is user-writable.
    const orgId = user?.app_metadata?.org_id;

    if (!user || !orgId) {
        redirect('/login');
    }

    return (
        <DashboardGate>
            <DashboardWebSocketProvider>
                <VoiceAgentProvider>
                    <div className="flex h-screen overflow-hidden bg-clinical-bg">
                        {/* Persistent Sidebar */}
                        <LeftSidebar />

                        {/* Main Content Area */}
                        <div className="flex-1 md:ml-72 flex flex-col h-full overflow-hidden relative">
                            {/* Command Palette */}
                            <CommandPalette />
                            <BackendStatusBanner />

                            <main className="flex-1 overflow-y-auto overflow-x-hidden pt-16 md:pt-4 pr-4 pb-4 bg-clinical-bg">
                                <EmailVerificationBanner />
                                {children}
                            </main>
                        </div>
                    </div>
                </VoiceAgentProvider>
            </DashboardWebSocketProvider>
        </DashboardGate>
    );
}
