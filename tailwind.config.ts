import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: "class",
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                // Clinical Trust Palette (Calendly Blue & Slate)
                "surgical-50": "#eff6ff",
                "surgical-100": "#dbeafe",
                "surgical-200": "#bfdbfe",
                "surgical-300": "#93c5fd",
                "surgical-400": "#60a5fa",
                "surgical-500": "#3b82f6",
                "surgical-600": "#006BFF", // Calendly Blue
                "surgical-700": "#1d4ed8",
                "surgical-800": "#1e40af",
                "surgical-900": "#1e3a8a",
                "navy-900": "#0F172A", // Slate 900 (Sharp Text)
                "slate-50": "#F8FAFC", // Subtle Background
                "slate-100": "#F1F5F9",
                "slate-600": "#475569",
                // Shadcn/UI color system
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                chart: {
                    "1": "hsl(var(--chart-1))",
                    "2": "hsl(var(--chart-2))",
                    "3": "hsl(var(--chart-3))",
                    "4": "hsl(var(--chart-4))",
                    "5": "hsl(var(--chart-5))",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
                full: "9999px", // Pill-shaped buttons
            },
            fontFamily: {
                sans: ["var(--font-inter)", "var(--font-plus-jakarta)", "system-ui", "sans-serif"],
                display: ["var(--font-plus-jakarta)", "var(--font-inter)", "system-ui", "sans-serif"],
                body: ["var(--font-inter)", "system-ui", "sans-serif"],
            },
            fontSize: {
                xs: ["0.75rem", { lineHeight: "1rem" }],
                sm: ["0.875rem", { lineHeight: "1.25rem" }],
                base: ["1rem", { lineHeight: "1.5rem" }],
                lg: ["1.125rem", { lineHeight: "1.75rem" }],
                xl: ["1.25rem", { lineHeight: "1.75rem" }],
                "2xl": ["1.5rem", { lineHeight: "2rem" }],
                "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
                "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
                "5xl": ["3rem", { lineHeight: "1.1" }],
                "6xl": ["3.75rem", { lineHeight: "1.1" }],
                "7xl": ["4.5rem", { lineHeight: "1.1" }],
                "8xl": ["6rem", { lineHeight: "1" }],
            },
            letterSpacing: {
                tighter: "-0.05em",
                tight: "-0.025em",
                normal: "0em",
                wide: "0.025em",
                wider: "0.05em",
                widest: "0.1em",
            },
            keyframes: {
                "gradient-x": {
                    "0%, 100%": {
                        "background-size": "200% 200%",
                        "background-position": "left center",
                    },
                    "50%": {
                        "background-size": "200% 200%",
                        "background-position": "right center",
                    },
                },
            },
            animation: {
                "gradient-x": "gradient-x 3s ease infinite",
            },
        },
    },
    plugins: [],
};
export default config;
