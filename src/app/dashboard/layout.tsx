import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import DashboardGate from './DashboardGate';
import { VoiceAgentProvider } from '@/contexts/VoiceAgentContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import LeftSidebar from '@/components/dashboard/LeftSidebar';
import CommandPalette from '@/components/dashboard/CommandPalette';

export const metadata: Metadata = {
    title: "Call Waiting AI AI - Voice Agent Dashboard",
    description: "Manage and test your Call Waiting AI AI voice agent",
};

export default async function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // Server-side org check: ensures org_id is present before rendering dashboard
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: any) {
                    cookieStore.set(name, value, options);
                },
                remove(name: string, options: any) {
                    cookieStore.delete(name);
                },
            },
        }
    );
    const {
        data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;
    const orgId = (user?.app_metadata as any)?.org_id || (user?.user_metadata as any)?.org_id;

    if (!session || !orgId) {
        redirect('/login');
    }

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
