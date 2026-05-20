"use client";

import { useState } from "react";

type Product = {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  orderBumps: { id: string; name: string; priceCents: number }[];
};

type CheckoutResult = {
  orderId: string;
  status: string;
  pix?: { qrCode: string; copyPaste: string; expiresAt: string };
};

export function CheckoutForm({ product }: { product: Product }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bumps, setBumps] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productSlug: product.slug,
        paymentMethod: "PIX",
        orderBumpIds: bumps,
        customer: {
          email: fd.get("email"),
          name: fd.get("name"),
          cpf: fd.get("cpf"),
          phone: fd.get("phone"),
        },
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erro ao processar pagamento");
      return;
    }
    setResult(data);
  }

  if (result?.pix) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">Pague com PIX</h2>
        {result.pix.qrCode && (
          <img
            src={`data:image/png;base64,${result.pix.qrCode}`}
            alt="QR Code"
            className="mx-auto mb-4 h-64 w-64"
          />
        )}
        <p className="mb-2 text-sm text-zinc-600">Código copia e cola:</p>
        <code className="block break-all rounded bg-zinc-100 p-3 text-xs">
          {result.pix.copyPaste}
        </code>
        <p className="mt-4 text-sm text-zinc-500">
          Assim que o pagamento for confirmado, você receberá o acesso por email.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-white p-6">
      <Field name="name" label="Nome completo" required />
      <Field name="email" label="Email" type="email" required />
      <Field name="cpf" label="CPF" required />
      <Field name="phone" label="WhatsApp" required />

      {product.orderBumps.length > 0 && (
        <div className="rounded-lg border-2 border-dashed border-brand-200 p-4">
          <p className="mb-2 text-sm font-semibold">🔥 Aproveite e leve junto:</p>
          {product.orderBumps.map((b) => (
            <label key={b.id} className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={bumps.includes(b.id)}
                onChange={(e) =>
                  setBumps((prev) =>
                    e.target.checked ? [...prev, b.id] : prev.filter((x) => x !== b.id),
                  )
                }
              />
              <span className="flex-1">{b.name}</span>
              <span className="font-semibold">
                + {(b.priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </label>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {loading ? "Processando..." : "Pagar com PIX"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </label>
  );
}
