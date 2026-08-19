/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
           colors: {
        base: '#0B0B16',              // ← avant #030308 : ardoise profonde qui respire
        panel: 'rgba(26,26,46,0.6)',
        ink: {
          50:  '#FAFAFD',
          100: '#F2F2F8',
          200: '#E0E0EC',             // texte principal plus lumineux
          300: '#BCBCD4',
          400: '#9090AC',
          500: '#6A6A88',
          600: '#4C4C68',
          700: '#383852',
          800: '#24243A',
          900: '#161624',
        },
        accent: {
          violet: '#A662FF',          // violet plus lumineux, "invite" plus
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
