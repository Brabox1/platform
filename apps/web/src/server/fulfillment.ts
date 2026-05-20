import { prisma } from "@checkout/db";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

/**
 * Chamado quando um Order vira PAID.
 * Libera acesso à área de membros, dispara entrega.
 */
export async function fulfillOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      product: { include: { course: true } },
      customer: true,
    },
  });

  if (!order) throw new Error("Order não encontrada");
  if (order.status !== "PAID") {
    throw new Error("Order não está paga, não pode fulfillar");
  }

  switch (order.product.deliveryType) {
    case "MEMBER_AREA":
      await grantMemberAccess(order);
      break;
    case "WHATSAPP":
      await deliverViaWhatsApp(order);
      break;
    case "REDIRECT":
    case "PDF_DOWNLOAD":
      // implementar conforme produto
      break;
  }
}

async function grantMemberAccess(order: NonNullable<Awaited<ReturnType<typeof prisma.order.findUnique>>>) {
  // já liberou? idempotência
  const existing = await prisma.memberAccess.findUnique({
    where: { orderId: order.id },
  });
  if (existing) return;

  const tempPassword = randomBytes(6).toString("hex"); // ex: a3f9b1c2d4
  const hash = await bcrypt.hash(tempPassword, 10);

  await prisma.memberAccess.create({
    data: {
      customerId: order.customerId,
      productId: order.productId,
      orderId: order.id,
      password: hash,
    },
  });

  // TODO: enviar email com Resend
  console.log(
    `[fulfill] Acesso liberado pra ${order.customer.email}. Senha temporária: ${tempPassword}`,
  );
}

async function deliverViaWhatsApp(order: NonNullable<Awaited<ReturnType<typeof prisma.order.findUnique>>>) {
  if (!order.customer.phone) return;

  // TODO: chamar Evolution API / Z-API
  console.log(
    `[fulfill] Entregar via WhatsApp pra ${order.customer.phone} — produto ${order.product.name}`,
  );
}
