import { NextRequest, NextResponse } from "next/server";
import { createCheckout, CheckoutInputSchema } from "@/server/checkout";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = CheckoutInputSchema.parse(body);
    const result = await createCheckout(input);

    return NextResponse.json({
      orderId: result.order.id,
      status: result.order.status,
      pix: result.transaction.pix,
      boleto: result.transaction.boleto,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
