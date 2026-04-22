/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          glass: 'rgba(18, 18, 20, 0.86)',
          line: 'rgba(255, 255, 255, 0.12)'
        }
      },
      boxShadow: {
        overlay: '0 28px 80px rgba(0, 0, 0, 0.45)'
      },
      keyframes: {
        overlayIn: {
          '0%': { opacity: '0', transform: 'translateX(34px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' }
        },
        borderFlash: {
          '0%': { boxShadow: 'inset 0 0 0 1px rgba(56, 189, 248, 0)' },
          '25%': { boxShadow: 'inset 0 0 0 1px rgba(56, 189, 248, 0.95)' },
          '100%': { boxShadow: 'inset 0 0 0 1px rgba(56, 189, 248, 0)' }
        },
        pulseDot: {
          '0%, 80%, 100%': { opacity: '0.35', transform: 'translateY(0)' },
          '40%': { opacity: '1', transform: 'translateY(-3px)' }
        }
      },
      animation: {
        overlayIn: 'overlayIn 300ms ease-out both',
        borderFlash: 'borderFlash 300ms ease-out both',
        pulseDot: 'pulseDot 1.2s ease-in-out infinite'
      }
    }
  },
  plugins: []
}
