/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        marsala: {
          50: '#fdf2f2',
          100: '#fce7e7',
          200: '#f9d2d2',
          300: '#f4b0b0',
          400: '#ec8080',
          500: '#e15555',
          600: '#cc3333',
          700: '#aa2828',
          800: '#8b2635',
          900: '#722832',
        },
        financial: {
          yellow: '#fbbf24',
          red: '#ef4444',
          blue: '#3b82f6',
        }
      }
    },
  },
  plugins: [],
};
