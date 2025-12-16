import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
    dest: "public",
    disable: process.env.NODE_ENV === "development",
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
        // In production, ensure backend URL is set
        if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_BACKEND_URL) {
            console.warn('⚠️ NEXT_PUBLIC_BACKEND_URL is not defined used for rewrites. Fallback to localhost which will likely fail in production container.');
        }

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        return [
            {
                source: '/api/:path*',
                destination: `${backendUrl}/api/:path*`,
            },
            {
                source: '/frontend/stream',
                destination: `${backendUrl}/frontend/stream`, // Next.js handles WS upgrades
            },
        ];
    },
    async redirects() {
        return [
            {
                source: '/auth/login',
                destination: '/login',
                permanent: true,
            },
            {
                source: '/auth/sign-up',
                destination: '/sign-up',
                permanent: true,
            },
            {
                source: '/auth/signup',
                destination: '/sign-up',
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
};

export default withPWA(nextConfig);
