/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Voxanne AI Clinical Trust Design System
        'sterile-white': '#F0F9FF',
        'deep-obsidian': '#020412',
        'surgical-blue': '#1D4ED8',
      },
      fontFamily: {
        sans: ['Inter', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
