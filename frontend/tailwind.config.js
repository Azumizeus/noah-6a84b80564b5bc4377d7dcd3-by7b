// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Base sombre premium — quasi-noir violacé pour profondeur
        base: {
          DEFAULT: '#030308',
          900: '#050510',
          800: '#0A0A18',
          700: '#12121F',
          600: '#1A1A2E',
        },
        // Solana violet — accueil vibrant, variantes claires pour AAA normal
        violet: {
          DEFAULT: '#9945FF',
          300: '#C49AFF', // texte petit — contraste 9.43:1 sur #030308 (AAA normal ✓)
          400: '#B070FF', // gros texte — 6.59:1 (AAA large ✓)
          500: '#9945FF',
          600: '#7A2EE0',
          700: '#5C1AB0',
        },
        // Neon green — signal de succès, AAA normal ✓ (13.6:1)
        neon: {
          DEFAULT: '#14F195',
          400: '#5BF7B5',
          500: '#14F195',
          600: '#0FBD74',
          700: '#0A8C56',
        },
        // Or — accents premium, AAA normal ✓ (14.5:1)
        gold: {
          DEFAULT: '#FFD700',
          400: '#FFE45C',
          500: '#FFD700',
          600: '#D4B400',
        },
        // Texte — palette calibrée pour contraste AAA sur #030308
        ink: {
          100: '#FFFFFF', // AAA normal ✓ (21:1)
          200: '#E6E6F0', // AAA normal ✓ (~16:1) — corps
          300: '#C4C4D6', // AAA normal ✓ (~11.8:1) — secondaire
          400: '#B0B0CE', // AAA normal ✓ (~9.6:1) — labels
          500: '#6E6E8C', // AA normal (~5.1:1) — désactivé uniquement
        },
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // Échelle modulaire 1.25 — base 16px
        'xs':   ['0.64rem',  { lineHeight: '0.875rem' }],
        'sm':   ['0.8rem',   { lineHeight: '1.125rem' }],
        'base': ['1rem',     { lineHeight: '1.5rem' }],
        'lg':   ['1.25rem',  { lineHeight: '1.75rem' }],
        'xl':   ['1.563rem', { lineHeight: '2rem' }],
        '2xl':  ['1.953rem', { lineHeight: '2.5rem' }],
        '3xl':  ['2.441rem', { lineHeight: '3rem' }],
        '4xl':  ['3.052rem', { lineHeight: '3.5rem' }],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        'glow-violet': '0 0 24px rgba(153, 69, 255, 0.25)',
        'glow-neon':   '0 0 24px rgba(20, 241, 149, 0.25)',
        'glow-gold':   '0 0 24px rgba(255, 215, 0, 0.20)',
      },
      keyframes: {
        'pulse-ring': {
          '0%':   { boxShadow: '0 0 0 0 rgba(20, 241, 149, 0.45)' },
          '70%':  { boxShadow: '0 0 0 10px rgba(20, 241, 149, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(20, 241, 149, 0)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.66, 0, 0, 1) infinite',
        'float':      'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
