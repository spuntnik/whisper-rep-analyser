import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#303F4B",
        pearl: "#E6DBBD",
        orange: "#FF7F00",
        blue: "#1F63AA",
        violet: "#535E8D",
        charcoal: "#303F4B",
      },
      boxShadow: {
        glow: "0 18px 60px rgba(48, 63, 75, 0.30)",
      },
      backgroundImage: {
        aura:
          "radial-gradient(circle at top left, rgba(83,94,141,0.35), transparent 24%), radial-gradient(circle at right 20%, rgba(255,127,0,0.18), transparent 24%), linear-gradient(180deg, #4f5b80 0%, #303F4B 60%, #202a33 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
