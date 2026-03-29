/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f0fdf4",
        ink: "#111827",
        accent: {
          DEFAULT: "#549E52",
          50: "#f2f8ec",
          100: "#e2f0d4",
          200: "#c5e1a9",
          300: "#98CD43",
          400: "#7ab847",
          500: "#549E52",
          600: "#549E52",
          700: "#537E2F",
          800: "#3d5e23",
          900: "#2a4118",
          950: "#16230d"
        },
        signal: "#ea580c"
      }
    }
  },
  plugins: []
};
