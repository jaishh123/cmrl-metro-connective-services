/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"DM Sans"', 'system-ui', 'sans-serif'] },
      colors: {
        navy: { 950: '#071329', 900: '#0b1f3f', 800: '#12294f', 700: '#1b3a6b' },
        sky: { 50: '#f3f8fe', 100: '#e6f0fc', 200: '#cfe2f9', 300: '#a9c9f3', 400: '#6fa3e8', 500: '#3b82d9', 600: '#2468bd', 700: '#1c5199' },
      },
    },
  },
  plugins: [],
};
