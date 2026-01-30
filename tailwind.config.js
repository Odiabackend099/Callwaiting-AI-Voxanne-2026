/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            animation: {
                "fade-in-up": "fade-in-up 0.5s ease-out",
                "marquee": "marquee 25s linear infinite",
                "marquee-reverse": "marquee-reverse 25s linear infinite",
                "gradient-x": "gradient-x 3s ease infinite",
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            },
            backgroundImage: {
                // Voxanne brand gradients
                'gradient-cream-sage': 'linear-gradient(to bottom, #FAF8F5, #E8F0EE)',
                'gradient-navy-blue': 'linear-gradient(135deg, #0a0e27 0%, #0015ff 100%)',
                'gradient-blue-light': 'linear-gradient(to right, #0015ff, #87ceeb)',
                'gradient-subtle-sage': 'linear-gradient(to bottom, #E8F0EE, #f5f5f5)',
                'gradient-medical': 'linear-gradient(135deg, #0a0e27 0%, #0015ff 50%, #4169ff 100%)',
                'premium-gradient': 'linear-gradient(135deg, #FFFFFF 0%, #F0F9FF 50%, #E0F2FE 100%)',
                'navy-gradient': 'linear-gradient(135deg, #0F1722 0%, #1B293D 100%)',
            },
            colors: {
                // ✅ APPROVED Clinical Trust Palette (Voxanne AI)
                // Single Source of Truth for Design System Colors
                "obsidian": {
                    DEFAULT: "#020412",         // Primary Text, Strong Headings
                },
                "surgical": {
                    50: "#F0F9FF",              // Sterile White (Backgrounds)
                    200: "#BFDBFE",             // Sky Mist (Borders, Highlights)
                    500: "#3B82F6",             // Clinical Blue (Icons, Accents)
                    600: "#1D4ED8",             // Electric Cobalt (Primary Buttons)
                },

                // Semantic Mappings (Primary usage in components)
                "clinical-bg": "#F0F9FF",       // Main app background
                "clinical-surface": "#FFFFFF", // Card background
                "clinical-border": "#BFDBFE",  // Border color

                // Deprecated Clinical Trust Palette (kept for backwards compatibility)
                "deep-obsidian": "#020412",     // Primary dark bg, footer, headers
                "surgical-blue": "#1D4ED8",     // Primary CTA buttons, active states ✅ FIXED
                "clinical-blue": "#3B82F6",     // Secondary actions, hover states
                "sky-mist": "#BFDBFE",          // Borders, subtle accents
                "sterile-wash": "#F0F9FF",      // Light backgrounds, sidebars
                "pure-white": "#FFFFFF",        // Main backgrounds, text on dark

                // Semantic mappings for component compatibility
                "blue-deep": "#020412",         // Deep Obsidian ✅ ADDED
                "charcoal": "#020412",          // Deep Obsidian ✅ ADDED
                "cream": "#F0F9FF",             // Sterile Wash ✅ ADDED
                "sage": "#BFDBFE",              // Sky Mist ✅ ADDED
                "sage-dark": "#3B82F6",         // Clinical Blue ✅ ADDED
                "cyan": "#3B82F6",              // Clinical Blue ✅ ADDED
                "lime": "#BFDBFE",              // Sky Mist (accent) ✅ ADDED
                "card-hover": "#BFDBFE",        // Sky Mist ✅ ADDED

                // Legacy surgical scale (for backwards compatibility)
                "surgical-50": "#eff6ff",
                "surgical-100": "#dbeafe",
                "surgical-200": "#bfdbfe",      // Maps to Sky Mist
                "surgical-300": "#93c5fd",
                "surgical-400": "#60a5fa",
                "surgical-500": "#3b82f6",      // Maps to Clinical Blue
                "surgical-600": "#1D4ED8",      // ✅ CORRECTED to Surgical Blue
                "surgical-700": "#1e40af",
                "surgical-800": "#1e3a8a",
                "surgical-900": "#1e3a8a",

                // Legacy navy scale (for backwards compatibility)
                "navy-50": "#F5F7FA",
                "navy-100": "#EBEFF5",
                "navy-200": "#CED8E5",
                "navy-300": "#A4B6D0",
                "navy-400": "#6D8AB0",
                "navy-500": "#456690",
                "navy-600": "#334E72",
                "navy-700": "#263A56",
                "navy-800": "#1B293D",
                "navy-900": "#0F1722",
                "navy-950": "#020412",          // ✅ Maps to Deep Obsidian
                // Voxanne Brand Color Palette
                voxanne: {
                    navy: {
                        DEFAULT: "#0a0e27",
                        light: "#1a1e37",
                    },
                    blue: {
                        bright: "#0015ff",
                        medium: "#4169ff",
                        light: "#87ceeb",
                        subtle: "#d6e9f5",
                    },
                    neutral: {
                        cream: "#FAF8F5",
                        sage: "#E8F0EE",
                        offWhite: "#f5f5f5",
                    },
                },
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
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                "fade-in-up": {
                    "0%": {
                        opacity: "0",
                        transform: "translateY(10px)",
                    },
                    "100%": {
                        opacity: "1",
                        transform: "translateY(0)",
                    },
                },
                marquee: {
                    '0%': { transform: 'translateX(0%)' },
                    '100%': { transform: 'translateX(-100%)' },
                },
                'marquee-reverse': {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(0%)' },
                },
            },
        },
    },
    plugins: [],
};
