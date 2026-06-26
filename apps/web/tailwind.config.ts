import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0b10",
        accent: "#2f6fed", // brand blue (Party Eventilicious)
      },
    },
  },
  plugins: [],
};

export default config;
