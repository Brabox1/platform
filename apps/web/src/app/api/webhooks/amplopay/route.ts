import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@checkout/db";
import { amploPay } from "@/lib/amplopay";
import { fulfillOrder } from "@/server/fulfillment";

// força runtime Node (precisa do crypto)
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature =
    req.headers.get("x-amplopay-signature") ??
    req.headers.get("x-signature");

  // 1) valida assinatura HMAC
  if (!amploPay.verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // 2) parse + valida estrutura
  let event;
  try {
    event = amploPay.parseWebhookEvent(rawBody);
  } catch (err) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  // 3) idempotência: já recebemos esse event?
  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_externalId: { provider: "amplopay", externalId: event.id } },
  });

  if (existing?.processedAt) {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  // 4) registra (ou pega o registro pendente)
  const orderId = event.data.externalReference ?? null;
  const record =
    existing ??
    (await prisma.webhookEvent.create({
      data: {
        provider: "amplopay",
        externalId: event.id,
        eventType: event.event,
        payload: rawBody as unknown as object, // o Prisma serializa
        orderId,
      },
    }));

  // 5) processa
  try {
    await handleEvent(event.event, event.data);

    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { processedAt: new Date(), error: null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { error: msg },
    });
    // 500 → AmploPay vai tentar de novo
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function handleEvent(
  type: string,
  data: { transactionId: string; externalReference?: string; status: string; paidAt?: string },
) {
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { amploTransactionId: data.transactionId },
        ...(data.externalReference ? [{ id: data.externalReference }] : []),
      ],
    },
  });
  if (!order) throw new Error(`Order não encontrada pra tx ${data.transactionId}`);

  switch (type) {
    case "transaction.paid":
      if (order.status === "PAID") return; // já tava pago
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "PAID",
          paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
        },
      });
      await fulfillOrder(order.id);
      break;

    case "transaction.refunded":
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "REFUNDED", refundedAt: new Date() },
      });
      // TODO: revogar acesso à área de membros
      break;

    case "transaction.chargeback":
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "CHARGEBACK" },
      });
      break;

    case "transaction.expired":
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "EXPIRED" },
      });
      break;

    case "transaction.failed":
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "FAILED" },
      });
      break;

    default:
      console.warn(`[webhook] evento não tratado: ${type}`);
  }
}
