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
        canvas: "#1c2a4a",
        primary: "#c9937d",
        secondary: "#1a7a8a",
        visual: "#c9937d",
        auditory: "#1a7a8a",
        kinesthetic: "#34d399",
        auditoryDigital: "#a78bfa",
      },
      boxShadow: {
        glow: "0 18px 60px rgba(25, 32, 62, 0.45)",
      },
      backgroundImage: {
        aura:
          "radial-gradient(circle at top left, rgba(201,147,125,0.20), transparent 28%), radial-gradient(circle at right 20%, rgba(26,122,138,0.18), transparent 24%), linear-gradient(180deg, #22355c 0%, #1c2a4a 52%, #132038 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
