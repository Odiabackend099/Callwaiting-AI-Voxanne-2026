import { Section } from "@/components/Section";

export function Footer() {
    return (
        <footer className="bg-white border-t border-slate-100">
            <Section className="py-12 md:py-16">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div className="text-left">
                        <div className="text-xl font-bold text-navy-900">Voxanne AI</div>
                        <p className="text-sm text-slate-500 mt-2 max-w-xs">
                            The Voice of Your Business, Powered by Intelligence.
                        </p>
                    </div>

                    <div className="flex flex-col text-left md:text-right gap-2 text-sm text-slate-600">
                        <p className="font-semibold text-navy-900">Voxanne AI Headquarters</p>
                        <p>20 AI Innovation Way, London, UK</p>
                        <p className="text-surgical-600 font-medium mt-1">Product of Call Waiting AI</p>
                    </div>
                </div>
                <div className="mt-12 pt-8 border-t border-slate-50 text-center md:text-left text-xs text-slate-400">
                    © {new Date().getFullYear()} Voxanne AI. All rights reserved.
                </div>
            </Section>
        </footer>
    );
}
