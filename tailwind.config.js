/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#0071E3',
          dark: '#0A84FF',
        },
        surface: {
          light: '#F5F5F7',
          dark: '#1C1C1E',
        },
        text: {
          primary: {
            light: '#1D1D1F',
            dark: '#F5F5F7',
          },
          secondary: {
            light: '#6E6E73',
            dark: '#98989D',
          }
        },
        success: {
          light: '#34C759',
          dark: '#30D158',
        },
        warning: {
          light: '#FF9F0A',
          dark: '#FFD60A',
        },
        danger: {
          light: '#FF3B30',
          dark: '#FF453A',
        }
      },
      borderRadius: {
        'card': '16px',
        'button': '12px',
        'input': '8px',
      },
      boxShadow: {
        'soft': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'glow': '0 0 15px rgba(10, 132, 255, 0.3)',
      },
      animation: {
        'marquee': 'marquee 30s linear infinite',
        'pulse-slow': 'pulse-slow 8s ease-in-out infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '0.1', transform: 'scale(1)' },
          '50%': { opacity: '0.3', transform: 'scale(1.1)' },
        }
      }
    },
  },
  plugins: [],
}
