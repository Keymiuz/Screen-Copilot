/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        ink: '#111114',
        panel: '#F7F7F5',
        line: 'rgba(17, 17, 20, 0.12)'
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '0.38', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.15)' }
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        pulseDot: 'pulseDot 1.2s ease-in-out infinite',
        slideIn: 'slideIn 180ms ease-out both'
      }
    }
  },
  plugins: []
}
