/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Light UI with bold yellow accent (similar to reference)
        'dark-bg': '#F5F5F5',           // page background
        'dark-surface': '#FFFFFF',      // panels/cards
        'dark-border': '#E5E7EB',       // light borders
        'dark-text': '#111827',         // gray-900
        'dark-text-secondary': '#6B7280',
        'accent': '#EAB308',            // darker, more vibrant yellow
        'accent-hover': '#CA8A04',
        'success': '#10b981',
        'warning': '#f59e0b',
        'error': '#ef4444'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
