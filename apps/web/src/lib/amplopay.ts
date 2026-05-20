import { AmploPayClient } from "@checkout/amplopay";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env ${name} é obrigatória`);
  return v;
}

export const amploPay = new AmploPayClient({
  clientId: required("AMPLOPAY_CLIENT_ID"),
  clientSecret: required("AMPLOPAY_CLIENT_SECRET"),
  baseUrl: process.env.AMPLOPAY_BASE_URL ?? "https://api.amplopay.com",
  webhookSecret: required("AMPLOPAY_WEBHOOK_SECRET"),
});
