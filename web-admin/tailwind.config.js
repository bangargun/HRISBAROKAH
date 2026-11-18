/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Inter dimuat lewat next/font di layout.tsx (variabel --font-sans)
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // Hitam logo Barokah: latar sidebar, tombol gelap, teks utama di atas emas
        ink: {
          DEFAULT: '#15181e',
          900: '#15181e',
          800: '#1d222b',
          700: '#2b313c',
          600: '#3a414e',
        },
        // Emas logo, satu-satunya aksen: tombol utama, menu aktif, tab aktif, cincin fokus.
        // 400 untuk isian (teks ink di atasnya 7,4:1), 500 untuk garis/fokus (>= 3:1 di putih dan ink),
        // 600-700 untuk teks/tautan di atas putih (5,5:1 dan 6,8:1).
        brand: {
          50: '#faf6ec',
          100: '#f3e8cc',
          200: '#e8d29e',
          300: '#dcb96b',
          400: '#cfa04a',
          500: '#a8781f',
          600: '#8a6220',
          700: '#7a5418',
          800: '#5e4114',
          900: '#45300f',
        },
        // Latar halaman: sedikit lebih redup dari putih agar kartu putih terbaca tanpa bayangan
        canvas: '#f4f6f8',
        slate: {
          // Sedikit lebih gelap dari bawaan (#64748b) agar teks sekunder tetap >= 4,5:1
          // juga di atas slate-100/200, bukan hanya di atas putih
          500: '#5a6779',
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
