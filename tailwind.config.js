/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        earth: {
          950: '#2D2118',
          900: '#3D2C1E',
          800: '#5C4033',
          700: '#7A5C4A',
          600: '#9A7B6A',
          500: '#B8957A',
          400: '#D4B896',
          300: '#E8D5C4',
          200: '#F0E6DC',
          100: '#F7F2EB',
          50: '#FCF9F5',
        },
      },
    },
  },
  plugins: [],
}
