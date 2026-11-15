/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Latar sidebar & aksen gelap aplikasi
        navy: {
          DEFAULT: '#0b172c',
          800: '#15243d',
          700: '#1e3150',
        },
        slate: {
          850: '#172033',
        },
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
      },
    },
  },
  plugins: [],
};
