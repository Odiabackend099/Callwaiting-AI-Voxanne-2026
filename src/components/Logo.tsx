'use client';

import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showText?: boolean;
    href?: string;
    className?: string;
    priority?: boolean;
}

const sizeMap = {
    sm: { container: 'w-8 h-8', text: 'text-sm' },
    md: { container: 'w-10 h-10', text: 'text-base' },
    lg: { container: 'w-12 h-12', text: 'text-lg' },
    xl: { container: 'w-14 h-14', text: 'text-xl' },
};

export default function Logo({
    size = 'lg',
    showText = true,
    href = '/',
    className = '',
    priority = false,
}: LogoProps) {
    const sizeConfig = sizeMap[size];

    const sizePixels = size === 'sm' ? 32 : size === 'md' ? 40 : size === 'lg' ? 48 : 56;

    const logoImage = (
        <Image
            src="/callwaiting-ai-logo.png"
            alt="CallWaiting AI Logo"
            width={sizePixels}
            height={sizePixels}
            className="object-contain transition-transform duration-300 hover:scale-105 w-auto h-auto"
            priority={priority}
        />
    );

    const content = (
        <div className={`flex items-center gap-3 group ${className}`}>
            {logoImage}
            {showText && (
                <span className={`${sizeConfig.text} font-bold text-white tracking-tight group-hover:text-slate-200 transition-colors`}>
                    CallWaiting AI
                </span>
            )}
        </div>
    );

    if (href) {
        return <Link href={href}>{content}</Link>;
    }

    return content;
}
