import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
    dest: "public",
    // Non-breaking default:
    // - Disable in development
    // - Enable in production only when explicitly turned on
    // This avoids reintroducing precache issues while still allowing PWA in prod.
    disable: process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENABLE_PWA !== 'true',
    register: true,
    skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
            },
            {
                protocol: 'https',
                hostname: 'callwaitingai.dev',
            },
        ],
    },
    async rewrites() {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        return [
            {
                source: '/frontend/stream',
                destination: `${backendUrl}/frontend/stream`, // Next.js handles WS upgrades
            },
        ];
    },
    async redirects() {
        return [
            {
                source: '/:path*',
                has: [
                    {
                        type: 'host',
                        value: 'www.callwaitingai.dev',
                    },
                ],
                destination: 'https://callwaitingai.dev/:path*',
                permanent: true,
            },
            {
                source: '/auth/login',
                destination: '/login',
                permanent: true,
            },
            {
                source: '/sign-up',
                destination: '/login',
                permanent: false,
            },
            {
                source: '/auth/sign-up',
                destination: '/login',
                permanent: false,
            },
            {
                source: '/auth/signup',
                destination: '/login',
                permanent: false,
            },
            {
                source: '/privacy-policy',
                destination: '/privacy',
                permanent: true,
            },
            {
                source: '/terms-of-service',
                destination: '/terms',
                permanent: true,
            },
        ];
    },
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(self), geolocation=()',
                    },
                ],
            },
        ];
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
};

export default withPWA(nextConfig);
