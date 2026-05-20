import { AmploPayClient } from "@checkout/amplopay";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env ${name} é obrigatória`);
  return v;
}

let _client: AmploPayClient | null = null;

function getClient(): AmploPayClient {
  if (_client) return _client;
  _client = new AmploPayClient({
    clientId: required("AMPLOPAY_CLIENT_ID"),
    clientSecret: required("AMPLOPAY_CLIENT_SECRET"),
    baseUrl: process.env.AMPLOPAY_BASE_URL ?? "https://api.amplopay.com",
    webhookSecret: required("AMPLOPAY_WEBHOOK_SECRET"),
  });
  return _client;
}

export const amploPay = new Proxy({} as AmploPayClient, {
  get(_target, prop) {
    const client = getClient();
    const value = client[prop as keyof AmploPayClient];
    return typeof value === "function" ? (value as Function).bind(client) : value;
  },
});
