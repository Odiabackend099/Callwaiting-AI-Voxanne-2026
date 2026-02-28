import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
    dest: "public",
    // Non-breaking default:
    // - Disable in development unless explicitly enabled
    // - Enable in production by default
    disable: process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_PWA !== 'true',
    register: true,
    skipWaiting: true,
    sw: 'sw.js',
    buildExcludes: [/middleware-manifest\.json$/, /_buildManifest\.js$/, /app-build-manifest\.json$/],
    runtimeCaching: [
        // Google Fonts (CacheFirst - fonts rarely change)
        {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
                },
            },
        },
        {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
                },
            },
        },
        // Static font files (StaleWhileRevalidate - balance freshness + speed)
        {
            urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font\.css)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
                cacheName: 'static-font-assets',
                expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
                },
            },
        },
        // Static images (StaleWhileRevalidate)
        {
            urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp|avif)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
                cacheName: 'static-image-assets',
                expiration: {
                    maxEntries: 64,
                    maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                },
            },
        },
        // Static media files (CacheFirst - large files, rarely change)
        {
            urlPattern: /\.(?:mp4|webm|ogg|mp3|wav|flac|aac)$/i,
            handler: 'CacheFirst',
            options: {
                cacheName: 'static-media-assets',
                rangeRequests: true,
                expiration: {
                    maxEntries: 32,
                    maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                },
            },
        },
        // JavaScript and CSS (StaleWhileRevalidate)
        {
            urlPattern: /\.(?:js|css)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
                cacheName: 'static-js-css-assets',
                expiration: {
                    maxEntries: 64,
                    maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
                },
            },
        },
        // API calls (NetworkFirst - prefer fresh data, fallback to cache)
        {
            urlPattern: /^https:\/\/api\.voxanne\.ai\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 10,
                expiration: {
                    maxEntries: 100,
                    maxAgeSeconds: 5 * 60, // 5 minutes
                },
                cacheableResponse: {
                    statuses: [0, 200],
                },
            },
        },
        // Pages (NetworkFirst - always try network first)
        {
            urlPattern: ({ url }) => {
                const isSameOrigin = self.origin === url.origin;
                if (!isSameOrigin) return false;
                const pathname = url.pathname;
                // Exclude API routes
                if (pathname.startsWith('/api/')) return false;
                // Exclude auth routes (always fetch fresh)
                if (pathname.includes('/auth') || pathname.includes('/login')) return false;
                return true;
            },
            handler: 'NetworkFirst',
            options: {
                cacheName: 'pages-cache',
                networkTimeoutSeconds: 10,
                expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 24 * 60 * 60, // 24 hours
                },
            },
        },
    ],
    fallbacks: {
        document: '/offline',
        // image: '/icons/offline-image.png', // Uncomment when image is created
    },
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
                hostname: 'voxanne.ai',
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
                        value: 'www.voxanne.ai',
                    },
                ],
                destination: 'https://voxanne.ai/:path*',
                permanent: true,
            },
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
                    {
                        key: 'Content-Security-Policy',
                        value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.vapi.ai https://*.sentry.io https://voxanneai.onrender.com; frame-ancestors 'none';",
                    },
                ],
            },
        ];
    },
};

export default withPWA(nextConfig);
