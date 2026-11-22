/**
 * Pembatas percobaan gagal di memori: setelah `maxFailures` kegagalan dalam
 * `windowMs`, kunci (mis. IP) diblokir sampai kegagalan tertua keluar dari jendela.
 * Hilang saat server restart, cukup untuk meredam tebak-tebakan kode/PIN.
 */
export class AttemptLimiter {
  private failures = new Map<string, number[]>();

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Pesan satu percobaan SEBELUM pekerjaan async dimulai. Mengembalikan false bila
   * jatah habis (jangan lanjut). Percobaan tetap terhitung kecuali `release` dipanggil
   * (mis. saat berhasil); karena sinkron, permintaan paralel tidak bisa menyelinap.
   */
  tryAcquire(key: string): boolean {
    const list = this.recent(key);
    if (list.length >= this.maxFailures) return false;
    list.push(this.now());
    this.failures.set(key, list);
    return true;
  }

  /** Kembalikan satu percobaan yang dipesan lewat tryAcquire (percobaan berhasil). */
  release(key: string) {
    const list = this.recent(key);
    list.pop();
    if (list.length) this.failures.set(key, list);
    else this.failures.delete(key);
  }

  /** Catat satu kegagalan tanpa pemesanan. */
  register(key: string) {
    const list = this.recent(key);
    list.push(this.now());
    this.failures.set(key, list);
  }

  isBlocked(key: string): boolean {
    return this.recent(key).length >= this.maxFailures;
  }

  /** Hapus catatan (mis. setelah berhasil). */
  reset(key: string) {
    this.failures.delete(key);
  }

  private recent(key: string): number[] {
    const cutoff = this.now() - this.windowMs;
    const list = (this.failures.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length) this.failures.set(key, list);
    else this.failures.delete(key);
    return list;
  }
}
