/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f6f8f3",
        ink: "#111827",
        accent: "#0e7490",
        signal: "#ea580c"
      }
    }
  },
  plugins: []
};
