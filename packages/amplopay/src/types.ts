import { z } from "zod";

// ─── Auth ───────────────────────────────────────────────
export const AmploAuthResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
});
export type AmploAuthResponse = z.infer<typeof AmploAuthResponseSchema>;

// ─── Customer ───────────────────────────────────────────
export const AmploCustomerSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  document: z.string(), // CPF/CNPJ
  phone: z.string().optional(),
});
export type AmploCustomer = z.infer<typeof AmploCustomerSchema>;

// ─── Create Transaction ─────────────────────────────────
export const CreateTransactionInputSchema = z.object({
  amount: z.number().int().positive(), // centavos
  paymentMethod: z.enum(["PIX", "CREDIT_CARD", "BOLETO"]),
  customer: AmploCustomerSchema,
  externalReference: z.string(),       // id do nosso Order
  description: z.string().optional(),
  postbackUrl: z.string().url(),       // URL do nosso webhook

  // só pra cartão
  card: z
    .object({
      number: z.string(),
      holderName: z.string(),
      expirationMonth: z.string(),
      expirationYear: z.string(),
      cvv: z.string(),
      installments: z.number().int().min(1).max(12).default(1),
    })
    .optional(),
});
export type CreateTransactionInput = z.infer<typeof CreateTransactionInputSchema>;

export const AmploTransactionSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "paid", "failed", "expired", "refunded", "chargeback"]),
  amount: z.number(),
  paymentMethod: z.string(),

  // PIX
  pix: z
    .object({
      qrCode: z.string(),       // base64 da imagem
      copyPaste: z.string(),    // código copia-e-cola
      expiresAt: z.string(),    // ISO date
    })
    .optional(),

  // boleto
  boleto: z
    .object({
      url: z.string().url(),
      barcode: z.string(),
      expiresAt: z.string(),
    })
    .optional(),

  createdAt: z.string(),
});
export type AmploTransaction = z.infer<typeof AmploTransactionSchema>;

// ─── Webhook ────────────────────────────────────────────
export const AmploWebhookEventSchema = z.object({
  id: z.string(),
  event: z.string(), // ex: "transaction.paid"
  createdAt: z.string(),
  data: z.object({
    transactionId: z.string(),
    externalReference: z.string().optional(),
    status: z.string(),
    amount: z.number().optional(),
    paidAt: z.string().optional(),
  }),
});
export type AmploWebhookEvent = z.infer<typeof AmploWebhookEventSchema>;
