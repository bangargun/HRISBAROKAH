import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import sharp = require('sharp');
import * as tf from '@tensorflow/tfjs';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import type { Human, Config } from '@vladmandic/human';

// Paket human tidak mengekspor build WASM lewat "exports", jadi dimuat dari path absolutnya
const HUMAN_DIST_DIR = dirname(require.resolve('@vladmandic/human'));
const WASM_DIST_DIR = dirname(require.resolve('@tensorflow/tfjs-backend-wasm')) + '/';
const MODEL_DIR = join(HUMAN_DIST_DIR, '..', 'models') + '/';

const DEFAULT_MATCH_THRESHOLD = 0.5;
const MAX_IMAGE_SIDE = 720;

/**
 * Pengenalan wajah di server dengan @vladmandic/human (backend WASM, tanpa native build).
 * Setiap foto diubah menjadi embedding 1024 angka; dua embedding dibandingkan
 * dengan skor kemiripan 0..1.
 */
@Injectable()
export class FaceRecognitionService implements OnModuleInit {
  private readonly logger = new Logger(FaceRecognitionService.name);
  private human: Human;
  readonly matchThreshold: number;

  constructor(config: ConfigService) {
    const fromEnv = parseFloat(config.get<string>('FACE_MATCH_THRESHOLD') ?? '');
    this.matchThreshold = Number.isFinite(fromEnv) ? fromEnv : DEFAULT_MATCH_THRESHOLD;
  }

  async onModuleInit() {
    // tfjs di Node tanpa tfjs-node tidak bisa membaca file:// lewat fetch, jadi file model dibaca dari disk
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input?.url;
      if (typeof url === 'string' && url.startsWith('file://')) {
        return new Response(await readFile(url.slice('file://'.length)));
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    setWasmPaths(WASM_DIST_DIR);
    const { Human: HumanWasm } = require(join(HUMAN_DIST_DIR, 'human.node-wasm.js'));
    const config: Partial<Config> = {
      backend: 'wasm',
      wasmPath: WASM_DIST_DIR,
      modelBasePath: `file://${MODEL_DIR}`,
      debug: false,
      face: {
        enabled: true,
        detector: { rotation: true, maxDetected: 3, minConfidence: 0.5 },
        mesh: { enabled: true },
        iris: { enabled: false },
        description: { enabled: true },
        emotion: { enabled: false },
        antispoof: { enabled: false },
        liveness: { enabled: false },
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      gesture: { enabled: false },
      segmentation: { enabled: false },
    };
    this.human = new HumanWasm(config);

    await this.human.init();
    await this.human.load();
    await this.human.warmup();
    this.logger.log(`Model wajah siap (backend ${tf.getBackend()}, batas cocok ${this.matchThreshold})`);
  }

  /** Embedding wajah dari foto; ditolak jika tidak ada wajah atau lebih dari satu wajah. */
  async describe(image: Buffer): Promise<number[]> {
    const { data, info } = await sharp(image)
      .rotate()
      .resize({
        width: MAX_IMAGE_SIDE,
        height: MAX_IMAGE_SIDE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const input = tf.tensor4d(new Uint8Array(data), [1, info.height, info.width, 3]);
    try {
      const result = await this.human.detect(input);
      if (result.face.length === 0) {
        throw new BadRequestException('Wajah tidak terdeteksi. Pastikan wajah terlihat jelas dan cahaya cukup.');
      }
      if (result.face.length > 1) {
        throw new BadRequestException('Terdeteksi lebih dari satu wajah. Foto hanya boleh berisi satu orang.');
      }
      const embedding = result.face[0].embedding;
      if (!embedding || embedding.length === 0) {
        throw new BadRequestException('Wajah kurang jelas untuk dikenali. Ulangi foto menghadap kamera.');
      }
      return Array.from(embedding);
    } finally {
      input.dispose();
    }
  }

  similarity(a: number[], b: number[]): number {
    return this.human.match.similarity(a, b);
  }

  /** Skor tertinggi antara satu embedding dan semua embedding acuan. */
  bestScore(embedding: number[], references: number[][]): number {
    return references.reduce((best, ref) => Math.max(best, this.similarity(embedding, ref)), 0);
  }
}
