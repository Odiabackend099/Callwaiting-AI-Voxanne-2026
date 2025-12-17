import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
    dest: "public",
    disable: true, // Disable PWA entirely to prevent precaching errors
    register: false,
    skipWaiting: false,
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
};

export default withPWA(nextConfig);
