import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          500: "#3b6fed",
          600: "#2f57c4",
          700: "#264aa6",
        },
      },
      fontFamily: {
        sans: ["Assistant", "Rubik", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
