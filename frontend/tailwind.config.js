/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme base
        surface: {
          DEFAULT: '#0D1117',  // page background
          card:    '#161B22',  // card background
          raised:  '#21262D',  // elevated elements
          border:  '#30363D',  // borders
        },
        // Text
        ink: {
          DEFAULT: '#E6EDF3',  // primary text
          muted:   '#8B949E',  // secondary text
          subtle:  '#484F58',  // disabled/placeholder
        },
        // Accent
        accent: {
          DEFAULT: '#2F81F7',  // primary blue
          hover:   '#1F6FEB',
          muted:   '#1C3A6B',  // subtle blue bg
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
