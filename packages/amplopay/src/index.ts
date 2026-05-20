import { createHmac, timingSafeEqual } from "node:crypto";
import {
  AmploAuthResponseSchema,
  AmploTransactionSchema,
  AmploWebhookEventSchema,
  CreateTransactionInputSchema,
  type AmploTransaction,
  type AmploWebhookEvent,
  type CreateTransactionInput,
} from "./types";

interface AmploPayConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  webhookSecret: string;
}

/**
 * Cliente da AmploPay.
 *
 * ⚠️ Os endpoints exatos (/auth/token, /transactions, etc.) podem variar
 * de acordo com a versão atual da API. Confira no painel da AmploPay
 * → Documentação e ajuste se necessário.
 */
export class AmploPayClient {
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private cfg: AmploPayConfig) {}

  // ─── Auth ─────────────────────────────────────────────
  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 30_000) {
      return this.accessToken;
    }

    const credentials = Buffer.from(
      `${this.cfg.clientId}:${this.cfg.clientSecret}`,
    ).toString("base64");

    const res = await fetch(`${this.cfg.baseUrl}/auth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ grant_type: "client_credentials" }),
    });

    if (!res.ok) {
      throw new AmploPayError(
        `Falha ao autenticar na AmploPay: ${res.status}`,
        await res.text(),
      );
    }

    const data = AmploAuthResponseSchema.parse(await res.json());
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
    return this.accessToken;
  }

  private async authedFetch<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${this.cfg.baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const body = await res.text();
    if (!res.ok) {
      throw new AmploPayError(
        `AmploPay ${res.status} em ${path}`,
        body,
      );
    }

    return body ? JSON.parse(body) : ({} as T);
  }

  // ─── Transactions ─────────────────────────────────────
  async createTransaction(
    input: CreateTransactionInput,
  ): Promise<AmploTransaction> {
    const parsed = CreateTransactionInputSchema.parse(input);
    const raw = await this.authedFetch<unknown>("/transactions", {
      method: "POST",
      body: JSON.stringify(parsed),
    });
    return AmploTransactionSchema.parse(raw);
  }

  async getTransaction(id: string): Promise<AmploTransaction> {
    const raw = await this.authedFetch<unknown>(`/transactions/${id}`);
    return AmploTransactionSchema.parse(raw);
  }

  async refundTransaction(id: string): Promise<AmploTransaction> {
    const raw = await this.authedFetch<unknown>(`/transactions/${id}/refund`, {
      method: "POST",
    });
    return AmploTransactionSchema.parse(raw);
  }

  // ─── Webhook ──────────────────────────────────────────
  /**
   * Verifica assinatura HMAC do webhook.
   * O header exato (X-Signature, X-Amplo-Signature, etc.) depende da AmploPay.
   * Ajuste conforme a doc oficial.
   */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader) return false;

    const expected = createHmac("sha256", this.cfg.webhookSecret)
      .update(rawBody)
      .digest("hex");

    try {
      const a = Buffer.from(expected, "hex");
      const b = Buffer.from(signatureHeader.replace(/^sha256=/, ""), "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  parseWebhookEvent(rawBody: string): AmploWebhookEvent {
    return AmploWebhookEventSchema.parse(JSON.parse(rawBody));
  }
}

export class AmploPayError extends Error {
  constructor(message: string, public details?: string) {
    super(message);
    this.name = "AmploPayError";
  }
}

export * from "./types";
