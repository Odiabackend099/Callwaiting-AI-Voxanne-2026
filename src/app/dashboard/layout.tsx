import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Roxanne AI - Voice Agent Dashboard",
    description: "Manage and test your Roxanne AI voice agent",
};

export default function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="min-h-screen bg-black text-white">
            {children}
        </div>
    );
}
