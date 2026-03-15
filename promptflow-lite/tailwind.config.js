/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // macOS vibrancy-aware surface colors
        'surface-1': 'rgba(255, 255, 255, 0.08)',
        'surface-2': 'rgba(255, 255, 255, 0.12)',
        'surface-3': 'rgba(255, 255, 255, 0.18)'
      },
      backdropBlur: {
        macos: '20px'
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 1.5s linear infinite'
      }
    }
  },
  plugins: []
}
