import { prisma, Prisma } from "@checkout/db";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const orderWithRelations = Prisma.validator<Prisma.OrderDefaultArgs>()({
  include: {
    product: { include: { course: true } },
    customer: true,
  },
});

type OrderWithRelations = Prisma.OrderGetPayload<typeof orderWithRelations>;

/**
 * Chamado quando um Order vira PAID.
 * Libera acesso à área de membros, dispara entrega.
 */
export async function fulfillOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    ...orderWithRelations,
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

async function grantMemberAccess(order: OrderWithRelations) {
  // idempotência
  const existing = await prisma.memberAccess.findUnique({
    where: { orderId: order.id },
  });
  if (existing) return;

  const tempPassword = randomBytes(6).toString("hex");
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

async function deliverViaWhatsApp(order: OrderWithRelations) {
  if (!order.customer.phone) return;

  // TODO: chamar Evolution API / Z-API
  console.log(
    `[fulfill] Entregar via WhatsApp pra ${order.customer.phone} — produto ${order.product.name}`,
  );
}
