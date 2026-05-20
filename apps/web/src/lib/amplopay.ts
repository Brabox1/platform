import { AmploPayClient } from "@checkout/amplopay";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env ${name} é obrigatória`);
  return v;
}

let _client: AmploPayClient | null = null;

export function getAmploPay(): AmploPayClient {
  if (_client) return _client;
  _client = new AmploPayClient({
    clientId: required("AMPLOPAY_CLIENT_ID"),
    clientSecret: required("AMPLOPAY_CLIENT_SECRET"),
    baseUrl: process.env.AMPLOPAY_BASE_URL ?? "https://api.amplopay.com",
    webhookSecret: required("AMPLOPAY_WEBHOOK_SECRET"),
  });
  return _client;
}

// Proxy lazy: continua funcionando o `amploPay.x()` como antes
export const amploPay = new Proxy({} as AmploPayClient, {
  get(_target, prop) {
    const client = getAmploPay();
    const value = client[prop as keyof AmploPayClient];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
