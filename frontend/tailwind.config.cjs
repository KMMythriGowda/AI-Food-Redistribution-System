/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          emerald: {
            DEFAULT: '#10B981',
            dark: '#059669',
            light: '#34D399',
            muted: 'rgba(16, 185, 129, 0.15)',
          },
          orange: {
            DEFAULT: '#F97316',
            dark: '#EA580C',
            light: '#FB923C',
            muted: 'rgba(249, 115, 22, 0.15)',
          },
          blue: {
            DEFAULT: '#3B82F6',
            dark: '#2563EB',
            light: '#60A5FA',
            muted: 'rgba(59, 130, 246, 0.15)',
          },
        },
        slate: {
          850: '#151F32',
          950: '#0B1120',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
