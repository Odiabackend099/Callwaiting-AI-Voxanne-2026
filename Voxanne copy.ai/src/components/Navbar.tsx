import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Navbar() {
    return (
        <nav className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-slate-100 transition-all duration-300">
            <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="text-2xl font-bold text-navy-900 tracking-tight hover:opacity-90 transition-opacity">
                    Voxanne AI
                </Link>

                {/* Actions */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" asChild className="text-slate-600 hover:text-navy-900 hover:bg-slate-50 font-medium">
                        <Link href="/login">Login</Link>
                    </Button>
                    <Button className="bg-surgical-600 hover:bg-surgical-700 text-white rounded-pill px-8 py-6 shadow-lg shadow-surgical-500/20 font-semibold transition-transform hover:scale-105">
                        Get Voxanne
                    </Button>
                </div>
            </div>
        </nav>
    );
}
