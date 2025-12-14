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

    const logoImage = (
        <div className={`relative ${sizeConfig.container} transition-transform duration-300 hover:scale-105`}>
            <Image
                src="/callwaiting-ai-logo.png"
                alt="CallWaiting AI Logo"
                fill
                sizes={size === 'sm' ? '32px' : size === 'md' ? '40px' : size === 'lg' ? '48px' : '56px'}
                className="object-contain"
                priority={priority}
            />
        </div>
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
