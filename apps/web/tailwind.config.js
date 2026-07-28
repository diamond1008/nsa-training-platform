/** NSA Training Platform — design tokens extracted from the Figma file
 *  "NSA Training Platform UI Design" (Be Vietnam Pro, NSA gold accent). */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#071426", // primary text / dark surfaces
          dark: "#0B1F3A", // page headings
          heading: "#142033",
          soft: "#20334F",
        },
        gtext: "#64748B", // secondary text
        gbg: "#F5F7FB", // page background
        gbg2: "#F1F4F9", // muted surface
        gborder: "#E3E8F0", // borders
        gold: {
          DEFAULT: "#EFC04B", // NSA accent
          dark: "#785A00", // accent hover / on-gold text
        },
        error: {
          DEFAULT: "#BA1A1A",
          bg: "#FFDAD6",
        },
        success: {
          DEFAULT: "#137A4B",
          bg: "#DDF7E9",
        },
        info: {
          DEFAULT: "#2563EB",
          bg: "#D6E3FF",
        },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(7, 20, 38, 0.04), 0 8px 24px rgba(7, 20, 38, 0.05)",
        elevated: "0 16px 48px rgba(7, 20, 38, 0.14)",
      },
    },
  },
  plugins: [],
};
