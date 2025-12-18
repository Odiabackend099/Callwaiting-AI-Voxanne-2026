import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                cream: '#F8F6F1',
                'cream-light': '#FAFAF8',
                sage: '#E8F3E8',
                'sage-dark': '#D1FAE5',
                'blue-deep': '#1E3A8A',
                cyan: '#06B6D4',
                lime: '#84CC16',
                charcoal: '#2D3748',
                'gray-light': '#F3F4F6',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                display: ['Poppins', 'system-ui', 'sans-serif'],
                mono: ['IBM Plex Mono', 'monospace'],
            },
            fontSize: {
                'h1-desktop': ['56px', { lineHeight: '1.1', fontWeight: '900' }],
                'h1-mobile': ['32px', { lineHeight: '1.1', fontWeight: '900' }],
                'h2-desktop': ['40px', { lineHeight: '1.2', fontWeight: '700' }],
                'h2-mobile': ['24px', { lineHeight: '1.2', fontWeight: '700' }],
                'h3-desktop': ['28px', { lineHeight: '1.3', fontWeight: '600' }],
                'h3-mobile': ['20px', { lineHeight: '1.3', fontWeight: '600' }],
            },
            spacing: {
                'xs': '4px',
                'sm': '12px',
                'md': '24px',
                'lg': '48px',
                'xl': '96px',
            },
            animation: {
                'parallax': 'parallax 0.5s ease-out',
                'float': 'float 3s ease-in-out infinite',
                'fade-in-up': 'fadeInUp 0.6s ease-out',
                'slide-in-left': 'slideInLeft 0.6s ease-out',
                'slide-in-right': 'slideInRight 0.6s ease-out',
            },
            keyframes: {
                parallax: {
                    '0%': { transform: 'translateY(0)' },
                    '100%': { transform: 'translateY(var(--parallax-offset, 50px))' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideInLeft: {
                    '0%': { opacity: '0', transform: 'translateX(-40px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                slideInRight: {
                    '0%': { opacity: '0', transform: 'translateX(40px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
            },
            boxShadow: {
                'card': '0 1px 3px rgba(0, 0, 0, 0.1)',
                'card-hover': '0 10px 25px rgba(0, 0, 0, 0.15)',
                'subtle': '0 1px 2px rgba(0, 0, 0, 0.05)',
            },
            backgroundImage: {
                'gradient-cream-sage': 'linear-gradient(135deg, #F8F6F1 0%, #E8F3E8 100%)',
                'gradient-sage-white': 'linear-gradient(135deg, #E8F3E8 0%, #FFFFFF 100%)',
            },
        },
    },
    plugins: [],
};
export default config;
