/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        nav: '#1e3a5f',
        bg: '#f8fafc',
        card: '#ffffff',
        border: '#e2e8f0',
        blue: { DEFAULT: '#2563eb', 600: '#2563eb' },
        green: { DEFAULT: '#16a34a', 600: '#16a34a' },
        amber: { DEFAULT: '#d97706', 600: '#d97706' },
        red: { DEFAULT: '#dc2626', 600: '#dc2626' },
        text: { DEFAULT: '#0f172a', dim: '#64748b' },
        'insights-bg': '#fffbeb',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'JetBrains Mono', 'Menlo', 'monospace'],
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.4)', opacity: '0.7' },
        },
        ping: {
          '75%, 100%': { transform: 'scale(2)', opacity: '0' },
        },
      },
      animation: {
        'pulse-dot': 'pulse-dot 1.4s ease-in-out infinite',
        ping: 'ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
}
