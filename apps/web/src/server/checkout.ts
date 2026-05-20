import { prisma } from "@checkout/db";
import { z } from "zod";
import { amploPay } from "@/lib/amplopay";

export const CheckoutInputSchema = z.object({
  productSlug: z.string(),
  customer: z.object({
    email: z.string().email(),
    name: z.string().min(2),
    cpf: z.string().min(11),
    phone: z.string().min(10),
  }),
  paymentMethod: z.enum(["PIX", "CREDIT_CARD"]),
  orderBumpIds: z.array(z.string()).default([]),
  utm: z
    .object({
      source: z.string().optional(),
      medium: z.string().optional(),
      campaign: z.string().optional(),
      term: z.string().optional(),
      content: z.string().optional(),
    })
    .optional(),
  card: z
    .object({
      number: z.string(),
      holderName: z.string(),
      expirationMonth: z.string(),
      expirationYear: z.string(),
      cvv: z.string(),
      installments: z.number().int().min(1).max(12),
    })
    .optional(),
});

export type CheckoutInput = z.infer<typeof CheckoutInputSchema>;

export async function createCheckout(input: CheckoutInput) {
  const data = CheckoutInputSchema.parse(input);

  // 1) carrega produto + vendedor + bumps
  const product = await prisma.product.findUnique({
    where: { slug: data.productSlug },
    include: {
      seller: true,
      orderBumps: { where: { id: { in: data.orderBumpIds } } },
    },
  });

  if (!product || !product.active) {
    throw new Error("Produto não encontrado ou inativo");
  }

  if (product.seller.kycStatus !== "APPROVED") {
    throw new Error(
      "Este vendedor ainda não concluiu a verificação. Aguarde a aprovação.",
    );
  }

  // 2) calcula total
  const bumpsTotal = product.orderBumps.reduce((sum, b) => sum + b.priceCents, 0);
  const totalCents = product.priceCents + bumpsTotal;

  // 3) upsert do customer
  const customer = await prisma.customer.upsert({
    where: { email: data.customer.email },
    create: {
      email: data.customer.email,
      name: data.customer.name,
      cpf: data.customer.cpf,
      phone: data.customer.phone,
    },
    update: {
      name: data.customer.name,
      cpf: data.customer.cpf,
      phone: data.customer.phone,
    },
  });

  // 4) cria Order (status PENDING)
  const order = await prisma.order.create({
    data: {
      sellerId: product.sellerId,
      customerId: customer.id,
      productId: product.id,
      status: "PENDING",
      paymentMethod: data.paymentMethod,
      totalCents,
      utmSource: data.utm?.source,
      utmMedium: data.utm?.medium,
      utmCampaign: data.utm?.campaign,
      utmTerm: data.utm?.term,
      utmContent: data.utm?.content,
      items: {
        create: [
          {
            name: product.name,
            priceCents: product.priceCents,
            type: "PRODUCT",
          },
          ...product.orderBumps.map((b) => ({
            name: b.name,
            priceCents: b.priceCents,
            type: "ORDER_BUMP" as const,
          })),
        ],
      },
    },
  });

  // 5) chama AmploPay
  const postbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/amplopay`;

  const amploTx = await amploPay.createTransaction({
    amount: totalCents,
    paymentMethod: data.paymentMethod,
    externalReference: order.id,
    description: product.name,
    postbackUrl,
    customer: {
      name: data.customer.name,
      email: data.customer.email,
      document: data.customer.cpf,
      phone: data.customer.phone,
    },
    card: data.card,
  });

  // 6) atualiza Order com dados da transação
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      amploTransactionId: amploTx.id,
      pixQrCode: amploTx.pix?.qrCode,
      pixCopyPaste: amploTx.pix?.copyPaste,
      pixExpiresAt: amploTx.pix?.expiresAt ? new Date(amploTx.pix.expiresAt) : undefined,
      // pra cartão aprovado na hora, o webhook que confirma — mas já dá pra refletir
      status: amploTx.status === "paid" ? "PAID" : "PENDING",
      paidAt: amploTx.status === "paid" ? new Date() : undefined,
    },
  });

  return { order: updated, transaction: amploTx };
}
