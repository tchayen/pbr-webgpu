const { slate, slateDark, blue, blueDark } = require("@radix-ui/colors");

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    fontSize: {
      sm: "12px",
    },
    extend: {
      animation: {
        "slide-down": "slideDown 100ms ease-out",
        "slide-up": "slideUp 100ms ease-out",
      },
      keyframes: {
        slideDown: {
          from: { height: 0, opacity: 0 },
          to: { height: "var(--radix-accordion-content-height)", opacity: 1 },
        },
        slideUp: {
          from: { height: "var(--radix-accordion-content-height)", opacity: 1 },
          to: { height: 0, opacity: 0 },
        },
      },
      colors: {
        ...slate,
        ...renameKeys("slate", slateDark),
        ...blue,
        ...renameKeys("blue", blueDark),
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

function renameKeys(name, colors) {
  return Object.fromEntries(
    Object.entries(colors).map(([key, value]) => {
      return [`${name}dark${key.replace(name, "")}`, value];
    }),
  );
}
