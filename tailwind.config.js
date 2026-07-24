/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'lato-sans': ['Lato_400Regular'],
        'lato-bold': ['Lato_700Bold'],
      },
      colors: {
        green: {
          50: '#EAF3DE',
          100: '#C0DD97',
          200: '#97C459',
          300: '#7AAE3C',
          400: '#639922',
          500: '#4F7D1A',
          600: '#3B6D11',
          700: '#2E5A0D',
          800: '#27500A',
          900: '#173404',
        },
        gray: {
          25: '#FAFAF8',
          50: '#F1EFE8',
          100: '#D3D1C7',
          200: '#B4B2A9',
          300: '#9E9C93',
          400: '#888780',
          500: '#737270',
          600: '#5F5E5A',
          700: '#4C4B48',
          800: '#444441',
          900: '#2C2C2A',
        },
      },
    },
  },
  plugins: [],
};