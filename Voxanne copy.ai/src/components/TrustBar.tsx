import { Section } from "@/components/Section";

export function TrustBar() {
    return (
        <div className="border-y border-slate-100 bg-slate-50/50">
            <Section className="py-10">
                <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">
                    Trusted by 500+ Leading Clinics
                </p>
                <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-8 opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500">
                    {/* Placeholders for logos (using text styles to simulate logos) */}
                    <div className="text-xl font-bold font-serif text-slate-600">MediCare+</div>
                    <div className="text-xl font-black text-slate-700 tracking-tighter">DENTALPRO</div>
                    <div className="text-xl font-medium text-slate-600 italic">HealthPoint</div>
                    <div className="text-xl font-bold text-slate-700 flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full bg-slate-400"></span>
                        ORTHO
                    </div>
                    <div className="text-xl font-light text-slate-800 tracking-widest">CLINIQUE</div>
                </div>
            </Section>
        </div>
    );
}
