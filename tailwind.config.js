/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#12151A',
          panel: '#1A1F27',
          raised: '#20262F',
          border: '#262D38',
        },
        fg: {
          DEFAULT: '#E7ECF2',
          muted: '#8B95A5',
          faint: '#5A6472',
        },
        accent: {
          cyan: '#45D6C4',
          green: '#59D48B',
          amber: '#F2B94D',
          red: '#F2665E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.02) inset, 0 0 0 1px #262D38',
        glow: '0 0 16px -2px currentColor',
      },
      animation: {
        'pulse-led': 'pulse-led 1.4s ease-in-out infinite',
      },
      keyframes: {
        'pulse-led': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 6px currentColor' },
          '50%': { opacity: '0.35', boxShadow: '0 0 2px currentColor' },
        },
      },
    },
  },
  plugins: [],
};
