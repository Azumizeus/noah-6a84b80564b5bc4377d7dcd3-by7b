/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: '#030308',
        panel: 'rgba(18,18,38,0.55)',
        // Échelle de gris pour les textes (indispensable !)
        ink: {
          50:  '#F8F8FC',
          100: '#EDEDF5',
          200: '#D4D4E3',
          300: '#ABABC2',
          400: '#82829E',
          500: '#5D5D78',
          600: '#44445C',
          700: '#303044',
          800: '#1E1E2E',
          900: '#12121F',
        },
        accent: {
          violet: '#9945FF',
          neon: '#14F195',
          gold: '#FFD700',
        },
      },
      fontFamily: {
        sans: ['Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'ui-monospace', 'monospace'],
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
    },
  },
  plugins: [],
}
