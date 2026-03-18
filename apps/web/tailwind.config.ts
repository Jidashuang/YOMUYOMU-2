import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7ff",
          100: "#d7ebff",
          500: "#1a73e8",
          700: "#114f9d",
          900: "#0a2f5e"
        }
      }
    }
  },
  plugins: []
};

export default config;
