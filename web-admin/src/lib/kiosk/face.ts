// Pengenalan wajah di tablet dengan @vladmandic/human (dimuat saat dibutuhkan, bukan di layar
// pasangan). Embedding dibuat dengan model dan setelan yang sama dengan server
// (backend/src/modules/face/face-recognition.service.ts) agar skornya sebanding; hanya tablet
// yang menyalakan antispoof + liveness (cek hidup).
import type { Config, Human } from '@vladmandic/human';
import { reportLoadedAssets } from './device';
import type { BootstrapRosterEntry } from './types';

/*
 * Ambang cek hidup. Skor human 0..1 per bingkai: `real` (antispoof: foto/layar vs wajah asli)
 * dan `live` (liveness). Wajah dianggap hidup bila kedua skor >= ambang pada salah satu bingkai.
 *
 * BELUM DISETEL DI TABLET NYATA. 0.5 adalah titik awal (bawaan human). Uji Task 9 di Chrome
 * headless dengan kamera palsu yang memutar foto diam (video Y4M dari foto uji) memberi:
 *   face-a  real 0.690 live 0.590;  face-b  real 0.520 live 1.000;  face-b dicerminkan  real 0.530 live 1.000
 * Semua LOLOS pada 0.5: foto digital yang diputar sebagai video tidak dikenali sebagai palsu,
 * dan real 0.52-0.53 hanya sedikit di atas ambang. Ambang ini belum menolak foto.
 * Langkah 3 (tablet Android nyata): ukur skor wajah asli dan foto di HP yang diangkat ke kamera
 * (skor dicatat di konsol "[absen] cek hidup ..."), setel sampai foto ditolak dan wajah asli
 * lolos >= 9 dari 10 percobaan, lalu catat nilai dan hasilnya di sini.
 */
export const REAL_MIN = 0.5;
export const LIVE_MIN = 0.5;

// Bingkai yang dicoba per pengambilan (jeda di antaranya); satu bingkai lolos sudah cukup
const FRAMES_PER_CAPTURE = 4;
const FRAME_GAP_MS = 200;
// Sama dengan MAX_IMAGE_SIDE server: deteksi pada ukuran yang sama dengan server
const DETECT_MAX_SIDE = 720;
// Foto absen: JPEG sisi terpanjang 480 px, di bawah batas server 180.000 karakter base64
const PHOTO_MAX_SIDE = 480;
const PHOTO_MAX_BASE64 = 170_000;
const JPEG_QUALITIES = [0.85, 0.75, 0.65, 0.5, 0.35];

const config: Partial<Config> = {
  modelBasePath: '/models/human/',
  // Cadangan WASM tanpa CDN: file .wasm tfjs 4.22.0 disajikan bersama model
  wasmPath: '/models/human/wasm/',
  debug: false,
  // Setiap pengambilan dianalisis utuh, tidak memakai hasil bingkai sebelumnya
  cacheSensitivity: 0,
  warmup: 'none',
  face: {
    enabled: true,
    detector: { rotation: true, maxDetected: 3, minConfidence: 0.5 },
    mesh: { enabled: true },
    iris: { enabled: false },
    description: { enabled: true },
    emotion: { enabled: false },
    antispoof: { enabled: true },
    liveness: { enabled: true },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
  segmentation: { enabled: false },
};

let human: Human | null = null;
let loading: Promise<void> | null = null;

async function create(backend: 'webgl' | 'wasm'): Promise<Human> {
  const { Human: HumanClass } = await import('@vladmandic/human');
  const h = new HumanClass({ ...config, backend });
  await h.init();
  if (h.tf.getBackend() !== backend) throw new Error(`Backend ${backend} tidak tersedia`);
  await h.load();
  return h;
}

/** Muat model wajah sekali (WebGL, cadangan WASM). Aman dipanggil berulang. */
export function loadFace(): Promise<void> {
  if (human) return Promise.resolve();
  if (!loading) {
    loading = create('webgl')
      .catch(() => create('wasm'))
      .then((h) => {
        human = h;
        console.info(`[absen] model wajah siap (backend ${h.tf.getBackend()})`);
        // Potongan kode human dan file model ikut disimpan service worker untuk offline
        reportLoadedAssets();
      })
      .catch((err) => {
        loading = null;
        throw err;
      });
  }
  return loading;
}

export interface FaceCapture {
  embedding: number[];
  jpegBase64: string; // tanpa awalan data:
  live: boolean;
  real: number; // skor antispoof bingkai terbaik
  liveScore: number; // skor liveness bingkai terbaik
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function drawFrame(video: HTMLVideoElement, maxSide: number): HTMLCanvasElement {
  const w = video.videoWidth;
  const h = video.videoHeight;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function jpegOf(source: HTMLCanvasElement): string {
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  let data = '';
  for (const q of JPEG_QUALITIES) {
    data = canvas.toDataURL('image/jpeg', q).split(',')[1] ?? '';
    if (data.length <= PHOTO_MAX_BASE64) break;
  }
  return data;
}

/**
 * Ambil beberapa bingkai dari kamera, cari satu wajah, buat embedding dan foto absen.
 * `live` false bila tidak ada bingkai yang lolos cek hidup (pemanggil meminta ulang).
 */
export async function captureAndDescribe(video: HTMLVideoElement): Promise<FaceCapture | { error: string }> {
  await loadFace();
  const h = human!;
  if (!video.videoWidth || !video.videoHeight) return { error: 'Kamera belum siap. Coba lagi.' };

  let best: FaceCapture | null = null;
  let sawMany = false;
  for (let i = 0; i < FRAMES_PER_CAPTURE; i++) {
    if (i > 0) await sleep(FRAME_GAP_MS);
    const frame = drawFrame(video, DETECT_MAX_SIDE);
    const result = await h.detect(frame);
    if (result.face.length > 1) {
      sawMany = true;
      continue;
    }
    const face = result.face[0];
    if (!face?.embedding || face.embedding.length === 0) continue;
    const real = face.real ?? 0;
    const liveScore = face.live ?? 0;
    const live = real >= REAL_MIN && liveScore >= LIVE_MIN;
    if (!best || live || real + liveScore > best.real + best.liveScore) {
      best = { embedding: Array.from(face.embedding), jpegBase64: jpegOf(frame), live, real, liveScore };
    }
    if (live) break;
  }
  if (best) return best;
  if (sawMany) return { error: 'Terlihat lebih dari satu wajah. Hanya satu orang di depan kamera.' };
  return { error: 'Wajah belum terlihat. Hadapkan wajah ke kamera dengan cahaya cukup.' };
}

/** Kru roster yang paling mirip, minimal `threshold` (bootstrap.matchThreshold). */
export function bestMatch(
  embedding: number[],
  roster: Pick<BootstrapRosterEntry, 'employeeId' | 'embeddings'>[],
  threshold: number,
): { employeeId: string; score: number } | null {
  if (!human) return null;
  let best: { employeeId: string; score: number } | null = null;
  for (const r of roster) {
    for (const ref of r.embeddings) {
      // Embedding dengan panjang berbeda (data lama) tidak bisa dibandingkan, sama dengan server
      if (ref.length !== embedding.length) continue;
      const score = human.match.similarity(embedding, ref);
      if (score >= threshold && (!best || score > best.score)) best = { employeeId: r.employeeId, score };
    }
  }
  return best;
}
