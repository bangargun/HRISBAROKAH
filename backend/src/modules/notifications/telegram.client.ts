import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

export interface SendResult {
  ok: boolean;
  /** Chat memblokir bot / tidak ada lagi: hubungan sebaiknya diputus */
  gone?: boolean;
}

/**
 * Bot Telegram HRIS. Aktif hanya bila TELEGRAM_BOT_TOKEN diisi; tanpa token semua kiriman diam.
 * TELEGRAM_API_BASE bisa diarahkan ke server palsu untuk uji.
 */
@Injectable()
export class TelegramClient implements OnModuleInit {
  private readonly logger = new Logger(TelegramClient.name);
  private readonly token = process.env.TELEGRAM_BOT_TOKEN ?? '';
  private readonly base = (process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org').replace(/\/$/, '');
  readonly webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
  readonly publicUrl = (process.env.APP_PUBLIC_URL ?? '').replace(/\/$/, '');
  private botUsername: string | null = null;

  get enabled() {
    return !!this.token;
  }

  async onModuleInit() {
    if (!this.enabled) return;
    // Tidak menahan start server: Telegram lambat/mati tidak boleh membuat API ikut mati
    void this.setup();
  }

  private async setup() {
    const me = await this.call<{ username: string }>('getMe', {});
    if (me) this.botUsername = me.username;
    if (this.publicUrl && this.webhookSecret) {
      await this.call('setWebhook', {
        url: `${this.publicUrl}/api/v1/telegram/webhook`,
        secret_token: this.webhookSecret,
        allowed_updates: ['message'],
      });
    }
  }

  async username(): Promise<string | null> {
    if (!this.enabled) return null;
    if (!this.botUsername) {
      const me = await this.call<{ username: string }>('getMe', {});
      this.botUsername = me?.username ?? null;
    }
    return this.botUsername;
  }

  /** Teks biasa (tanpa format) + tombol "Buka" bila ada tautan https. */
  async send(chatId: string, text: string, link?: string): Promise<SendResult> {
    if (!this.enabled) return { ok: false };
    const body: Record<string, unknown> = { chat_id: chatId, text, disable_web_page_preview: true };
    if (link) body.reply_markup = { inline_keyboard: [[{ text: 'Buka', url: link }]] };
    const res = await this.raw('sendMessage', body);
    if (res.ok) return { ok: true };
    return { ok: false, gone: res.status === 403 || res.status === 400 && /chat not found/i.test(res.description) };
  }

  private async call<T>(method: string, body: Record<string, unknown>): Promise<T | null> {
    const res = await this.raw(method, body);
    return res.ok ? (res.result as T) : null;
  }

  private async raw(method: string, body: Record<string, unknown>) {
    try {
      const r = await fetch(`${this.base}/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await r.json().catch(() => ({}))) as { ok?: boolean; result?: unknown; description?: string };
      if (!data.ok) this.logger.warn(`Telegram ${method} gagal (${r.status}): ${data.description ?? ''}`);
      return { ok: !!data.ok, status: r.status, result: data.result, description: data.description ?? '' };
    } catch (err) {
      this.logger.warn(`Telegram ${method} tidak terkirim: ${(err as Error).message}`);
      return { ok: false, status: 0, result: undefined, description: '' };
    }
  }
}
