/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        police: {
          dark: '#0f172a',
          navy: '#1e293b',
          gold: '#f59e0b',
          khaki: '#d97706',
          accent: '#2563eb'
        }
      }
    },
  },
  plugins: [],
}
