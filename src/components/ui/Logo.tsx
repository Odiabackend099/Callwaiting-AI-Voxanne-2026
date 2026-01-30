import Image from "next/image";

interface LogoProps {
    className?: string;
    width?: number;
    height?: number;
}

export default function Logo({ className = "", width = 150, height = 40 }: LogoProps) {
    return (
        <div className={`relative ${className}`}>
            <Image
                src="/Brand/8.png"
                alt="Voxanne AI Logo"
                width={width}
                height={height}
                className="object-contain"
                priority
            />
        </div>
    );
}
