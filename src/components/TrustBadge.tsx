import { ShieldCheck } from "lucide-react";

interface TrustBadgeProps {
    text?: string;
}

export default function TrustBadge({ text = "HIPAA Compliant" }: TrustBadgeProps) {
    return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surgical-50 border border-surgical-100 text-surgical-600 text-xs font-medium tracking-wide">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{text}</span>
        </div>
    );
}
