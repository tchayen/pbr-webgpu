const { slate, slateDark } = require("@radix-ui/colors");

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ...slate,
        ...renameKeys("slate", slateDark),
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

function renameKeys(name, colors) {
  return Object.fromEntries(
    Object.entries(colors).map(([key, value]) => {
      return [`${name}dark${key.replace(name, "")}`, value];
    })
  );
}
