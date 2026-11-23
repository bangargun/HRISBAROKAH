import { createRequire } from 'module';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
// @vladmandic/human: "exports" memilih build Node (butuh @tensorflow/tfjs-node) saat Next
// menyusun bundel server. Tablet absen hanya memakainya di browser: selalu pakai build ESM.
const HUMAN_ESM = join(dirname(require.resolve('@vladmandic/human')), 'human.esm.js');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config) {
    config.resolve.alias = { ...config.resolve.alias, '@vladmandic/human$': HUMAN_ESM };
    return config;
  },
  async headers() {
    return [
      {
        // Service worker tablet absen: selalu cek versi terbaru, tidak dari cache HTTP
        source: '/absen-sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
    ];
  },
};

export default nextConfig;
