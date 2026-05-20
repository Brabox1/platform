import { prisma } from "@checkout/db";
import { notFound } from "next/navigation";
import { CheckoutForm } from "@/components/checkout-form";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      orderBumps: { where: { active: true } },
      seller: { select: { name: true, kycStatus: true } },
    },
  });

  if (!product || !product.active) notFound();
  if (product.seller.kycStatus !== "APPROVED") {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-zinc-600">
          Este produto ainda não está disponível pra venda.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{product.name}</h1>
        {product.description && (
          <p className="mt-2 text-zinc-600">{product.description}</p>
        )}
        <p className="mt-4 text-2xl font-bold text-brand-600">
          {(product.priceCents / 100).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}
        </p>
      </div>

      <CheckoutForm product={product} />
    </main>
  );
}
