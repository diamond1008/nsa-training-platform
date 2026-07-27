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
        },
        gtext: "#667085", // secondary text
        gbg: "#F7F9FC", // page background
        gbg2: "#F2F4F7", // muted surface
        gborder: "#ECEEF1", // borders
        gold: {
          DEFAULT: "#EFC04B", // NSA accent
          dark: "#785A00", // accent hover / on-gold text
        },
        error: {
          DEFAULT: "#BA1A1A",
          bg: "#FFDAD6",
        },
        info: {
          bg: "#D6E3FF",
        },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(7, 20, 38, 0.08)",
      },
    },
  },
  plugins: [],
};