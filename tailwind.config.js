/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: { 950: '#022c65', 900: '#052d60', 800: '#07346c', 700: '#0a4a9e' },
        brand: { DEFAULT: '#0a96ff', dark: '#0078e0', light: '#38b6ff' },
        mist: '#f5f8fc',
      },
      fontFamily: { sans: ['Plus Jakarta Sans Variable', 'Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'] },
    },
  },
  plugins: [],
}
