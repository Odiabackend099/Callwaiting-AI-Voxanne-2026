import type { Metadata } from "next";
import DashboardGate from './DashboardGate';

export const metadata: Metadata = {
    title: "Voxanne AI - Voice Agent Dashboard",
    description: "Manage and test your Voxanne AI voice agent",
};

export default function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="min-h-screen bg-black text-white">
            <DashboardGate>{children}</DashboardGate>
        </div>
    );
}
