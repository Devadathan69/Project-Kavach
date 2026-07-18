import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#07111D",
        panel: "#0D1B2A",
        line: "#263C51",
        ink: "#EAF3FA",
        muted: "#9DB3C6",
        signal: "#49D7FF",
        safe: "#60E7A6",
        warning: "#FFCB66",
        critical: "#FF6577"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(73, 215, 255, .16), 0 16px 48px rgba(0, 0, 0, .24)"
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Arial", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
