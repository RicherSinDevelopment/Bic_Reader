/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // tailwind.config.js
  
  theme: {
    extend: {
       fontFamily: {
        "lato-sans": ["Lato_400Regular"],
        "lato-bold": ["Lato_700Bold"],
       },
            colors: {
        // Primary — pistachio green
        green: {
          50: "#EAF3DE",
          100: "#C0DD97",
          200: "#97C459", // accent / active icons
          300: "#7AAE3C",
          400: "#639922", // primary brand color
          500: "#4F7D1A",
          600: "#3B6D11", // pressed state
          700: "#2E5A0D",
          800: "#27500A",
          900: "#173404", // dark text on light green fills
        },
 
        // Neutral — warm grays (matches green's undertone)
        gray: {
          25: "#FAFAF8", // page background
          50: "#F1EFE8", // card background
          100: "#D3D1C7", // dividers, borders
          200: "#B4B2A9", // disabled states
          300: "#9E9C93",
          400: "#888780", // secondary / muted text
          500: "#737270",
          600: "#5F5E5A",
          700: "#4C4B48",
          800: "#444441",
          900: "#2C2C2A", // primary text
        },
      },
    },
  },
  plugins: [],
}